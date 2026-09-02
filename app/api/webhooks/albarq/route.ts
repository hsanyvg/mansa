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

    let snapshot = await adminDb.collectionGroup('orders').where('id', '==', receiptNumber).get();
    
    if (snapshot.empty) {
      snapshot = await adminDb.collectionGroup('orders').where('orderNumber', '==', receiptNumber).get();
    }
    
    if (snapshot.empty) {
      snapshot = await adminDb.collectionGroup('orders').where('albarqReceiptNumber', '==', receiptNumber).get();
    }

    if (snapshot.empty) {
      statusMessage = 'Order not found in the system';
      await logWebhook(null, timestamp, body, 'failed', statusMessage);
      return NextResponse.json({ success: false, message: statusMessage }, { status: 404 });
    }

    orderDoc = snapshot.docs[0];
    
    // Extract userId from the path: users/{userId}/orders/{orderId}
    const orderPath = orderDoc.ref.path;
    const pathParts = orderPath.split('/');
    if (pathParts.length >= 4 && pathParts[0] === 'users') {
      userId = pathParts[1];
    }

    const currentData = orderDoc.data();
    
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

    // Update order in database
    await orderDoc.ref.update(updateData);

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
