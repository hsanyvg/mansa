import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';

export async function POST(req: Request) {
  const timestamp = new Date();
  let body: any = {};
  let statusMessage = '';
  let userId = '';

  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, message: 'Database not initialized' }, { status: 500 });
    }

    // 1. Security Check (Secret Key)
    const apiKey = req.headers.get('x-api-key');
    const secret = process.env.ALBARQ_WEBHOOK_SECRET;

    if (!apiKey || apiKey !== secret) {
      statusMessage = 'Unauthorized: Missing or invalid API key';
      await logWebhook(null, timestamp, {}, 'failed', statusMessage);
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    body = await req.json();

    const { receiptNumber, status, note } = body;

    if (!receiptNumber || !status) {
      statusMessage = 'Missing receiptNumber or status';
      await logWebhook(null, timestamp, body, 'failed', statusMessage);
      return NextResponse.json({ success: false, message: statusMessage }, { status: 400 });
    }

    // 2. Map Status
    const normalizedStatus = status.toLowerCase();
    let targetStatus = normalizedStatus;
    
    if (normalizedStatus.includes('replace') && normalizedStatus.includes('deliver')) targetStatus = 'delivered_replaced';
    else if (normalizedStatus === 'delivered_replaced' || normalizedStatus === 'replaced') targetStatus = 'delivered_replaced';
    else if (normalizedStatus.includes('deliver') || normalizedStatus === 'successful') targetStatus = 'delivered';
    else if (normalizedStatus.includes('return') || normalizedStatus.includes('rto')) targetStatus = 'returned';
    else if (normalizedStatus.includes('postpone')) targetStatus = 'postponed';
    else if (normalizedStatus.includes('partial')) targetStatus = 'partial';
    else if (normalizedStatus.includes('ship')) targetStatus = 'shipped';
    else if (normalizedStatus.includes('ofd') || normalizedStatus.includes('out for delivery') || normalizedStatus.includes('مندوب') || normalizedStatus.includes('بطريق')) targetStatus = 'ofd';
    else if (normalizedStatus.includes('address') || normalizedStatus === 'address_changed') targetStatus = 'address_changed';
    else if (normalizedStatus.includes('resen') || normalizedStatus === 'resent') targetStatus = 'resent';
    else if (normalizedStatus.includes('process') || normalizedStatus === 'processing' || normalizedStatus.includes('pend')) targetStatus = 'processing';

    // 3. Find Order (Multi-tenant support)
    let orderDoc = null;

    // 1. Try to find by Document ID across all tenants
    const usersSnapshot = await adminDb.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const docRef = adminDb.collection('users').doc(userDoc.id).collection('orders').doc(receiptNumber);
      const snap = await docRef.get();
      if (snap.exists) {
        orderDoc = snap;
        break;
      }
    }

    // 2. Fallback to searching by orderNumber or albarqReceiptNumber
    if (!orderDoc) {
      let snapshot = await adminDb.collectionGroup('orders').where('orderNumber', '==', receiptNumber).get();
      
      if (snapshot.empty) {
        snapshot = await adminDb.collectionGroup('orders').where('albarqReceiptNumber', '==', receiptNumber).get();
      }
      
      if (snapshot.empty) {
        snapshot = await adminDb.collectionGroup('orders').where('id', '==', receiptNumber).get();
      }

      if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];
      }
    }

    if (!orderDoc) {
      statusMessage = 'Order not found in the system';
      await logWebhook(null, timestamp, body, 'failed', statusMessage);
      return NextResponse.json({ success: false, message: statusMessage }, { status: 404 });
    }

    // Extract userId from the path: users/{userId}/orders/{orderId}
    const orderPath = orderDoc.ref.path;
    const pathParts = orderPath.split('/');
    if (pathParts.length >= 4 && pathParts[0] === 'users') {
      userId = pathParts[1];
    }

    const currentData = orderDoc.data();
    if (!currentData) {
      return NextResponse.json({ success: false, message: 'Order data is missing' }, { status: 404 });
    }
    
    const updateData: any = {
      status: targetStatus,
      updatedAt: timestamp,
      updatedBy: 'albarq_webhook'
    };
    
    if (note) {
      updateData.deliveryNote = note;
    }

    // معالجة خاصة للطلبات الراجعة (تصفير تكلفة التوصيل إذا تطلب الأمر)
    if (targetStatus === 'returned') {
      updateData.deliveryCost = 0;
      if (currentData.deliveryCost > 0) {
        const currentTotal = currentData.totalAmount || currentData.price || 0;
        updateData.totalAmount = currentTotal + currentData.deliveryCost;
      }
    }

    // --- STOCK SYNC LOGIC ---
    const batch = adminDb.batch();
    batch.update(orderDoc.ref, updateData);

    const oldStatus = currentData.status || 'pending';
    const newStatus = targetStatus;

    if (oldStatus !== newStatus && currentData.items && currentData.items.length > 0) {
      const getStockState = (st: string) => {
        if (['shipped', 'delivered', 'partial', 'returned_agent', 'returned'].includes(st)) return 'HARD_DEDUCTED';
        if (['cancelled', 'returned_warehouse'].includes(st)) return 'FREE';
        return 'SOFT_ALLOCATED';
      };

      const applyStockTransition = (stock: any, oldState: string, newState: string, qty: number, defaultUnit: string) => {
        const changeReserved = (amount: number) => {
           const firstStoreKey = Object.keys(stock)[0] || 'default_store';
           if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
           stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + amount;
        };

        const changeQuantity = (amount: number) => {
           if (amount > 0) {
             const firstStoreKey = Object.keys(stock)[0] || 'default_store';
             if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
             stock[firstStoreKey].quantity += amount;
           } else {
             let remaining = Math.abs(amount);
             for (const storeId in stock) {
               if (remaining <= 0) break;
               if (stock[storeId].quantity > 0) {
                 const deduct = Math.min(stock[storeId].quantity, remaining);
                 stock[storeId].quantity -= deduct;
                 remaining -= deduct;
               }
             }
             if (remaining > 0) {
               const firstStoreKey = Object.keys(stock)[0] || 'default_store';
               if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
               stock[firstStoreKey].quantity -= remaining;
             }
           }
        };

        if (oldState === 'SOFT_ALLOCATED' && newState === 'HARD_DEDUCTED') {
           changeReserved(-qty);
           changeQuantity(-qty);
        } else if (oldState === 'SOFT_ALLOCATED' && newState === 'FREE') {
           changeReserved(-qty);
        } else if (oldState === 'HARD_DEDUCTED' && newState === 'FREE') {
           changeQuantity(qty);
        } else if (oldState === 'FREE' && newState === 'SOFT_ALLOCATED') {
           changeReserved(qty);
        } else if (oldState === 'FREE' && newState === 'HARD_DEDUCTED') {
           changeQuantity(-qty);
        } else if (oldState === 'HARD_DEDUCTED' && newState === 'SOFT_ALLOCATED') {
           changeQuantity(qty);
           changeReserved(qty);
        }
      };

      const oldState = getStockState(oldStatus);
      const newState = getStockState(newStatus);

      if (oldState !== newState) {
        for (const item of currentData.items) {
          if (item.isComposite && item.composition) {
            for (const comp of item.composition) {
              const rawProdRef = adminDb.collection('users').doc(userId).collection('products').doc(comp.itemId);
              const rawSnap = await rawProdRef.get();
              if (rawSnap.exists) {
                const rawData = rawSnap.data();
                let stock = { ...rawData.stock };
                let qty = comp.quantityNeeded * item.quantity;
                
                applyStockTransition(stock, oldState, newState, qty, rawData.units?.[0]?.type || 'قطعة');
                
                let newTotalBaseQuantity = 0;
                Object.values(stock).forEach((s: any) => {
                  const uMul = rawData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                  newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
                });
                batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
              }
            }
          } else {
            if (!item.productId) continue;
            const prodRef = adminDb.collection('users').doc(userId).collection('products').doc(item.productId);
            const prodSnap = await prodRef.get();
            if (prodSnap.exists) {
              const prodData = prodSnap.data();
              let stock = { ...prodData.stock };
              let qty = item.quantity;

              applyStockTransition(stock, oldState, newState, qty, prodData.units?.[0]?.type || 'قطعة');

              let newTotalBaseQuantity = 0;
              Object.values(stock).forEach((s: any) => {
                const uMul = prodData.units?.find((u: any) => u.type === s.unit)?.count || 1;
                newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
              });
              batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
            }
          }
        }
      }
    }

    await batch.commit();

    // 4. Logging for specific tenant
    statusMessage = 'Order status updated successfully';
    await logWebhook(userId, timestamp, body, 'success', statusMessage);

    return NextResponse.json({ success: true, message: statusMessage, newStatus: targetStatus });
  } catch (error: any) {
    console.error('Albarq Webhook Error:', error);
    statusMessage = `Internal Server Error: ${error.message}`;
    await logWebhook(userId || null, timestamp, body, 'failed', statusMessage);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// Helper to save webhook logs
async function logWebhook(userId: string | null, timestamp: Date, payload: any, status: string, reason: string) {
  const logData = {
    timestamp,
    provider: 'Albarq',
    payload,
    status,
    reason,
  };

  try {
    if (userId) {
      // Log inside the specific tenant's webhook_logs collection
      await adminDb!.collection('users').doc(userId).collection('webhook_logs').add(logData);
    } else {
      // Log globally if user not identified
      await adminDb!.collection('webhook_logs').add(logData);
    }
  } catch (e) {
    console.error('Failed to save webhook log:', e);
  }
}
