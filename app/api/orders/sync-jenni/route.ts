import { NextResponse } from 'next/server';
import { db, auth } from '../../../../lib/firebase';
import { doc, updateDoc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

export async function POST(req: Request) {
  try {
    // Authenticate anonymously on the server side to bypass Firestore rules that require auth when client SDK is used
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(err => console.error("Server-side anonymous authentication failed:", err));
    }

    // Read optional userId and client-provided shipmentNumbers from body
    const body = await req.json().catch(() => ({}));
    const reqUserId = body.userId;
    const clientShipmentNumbers = body.shipmentNumbers;

    // 1. Fetch Integration Settings to get the token using client SDK
    let integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    if (reqUserId) {
      const userIntegrationRef = doc(db, 'users', reqUserId, 'integrations', 'delivery');
      const userIntegrationSnap = await getDoc(userIntegrationRef);
      if (userIntegrationSnap.exists()) {
        integrationRef = userIntegrationRef;
      }
    }

    const integrationSnap = await getDoc(integrationRef);
    if (!integrationSnap.exists()) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد ربط شركة التوصيل' }, { status: 400 });
    }

    const integrationData = integrationSnap.data();
    if (!integrationData || !integrationData.username || !integrationData.password) {
      return NextResponse.json({ success: false, message: 'بيانات الدخول لشركة التوصيل مفقودة' }, { status: 400 });
    }

    // Login to Jenni API to get token
    const loginRes = await fetch('https://almasara.jenni.delivery/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: integrationData.username,
        password: integrationData.password
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      return NextResponse.json({ success: false, message: 'فشل تسجيل الدخول لشركة التوصيل' }, { status: 401 });
    }

    const token = loginData.token.replace('Bearer ', '').trim();

    // 2. Determine shipments to query
    const activeStatuses = ['shipped', 'ofd', 'postponed'];
    let shipmentsToQuery: string[] = [];
    const orderMap: Record<string, { id: string, uid: string, data: any }> = {};

    if (Array.isArray(clientShipmentNumbers) && clientShipmentNumbers.length > 0) {
      // Use client-provided list directly to avoid DB read overhead on the server completely
      shipmentsToQuery = clientShipmentNumbers;
    } else {
      // Fallback: Query Firestore for active orders using client Firestore SDK
      if (reqUserId) {
        const userOrdersRef = collection(db, 'users', reqUserId, 'orders');
        const q = fsQuery(userOrdersRef, where('status', 'in', activeStatuses));
        const snap = await getDocs(q);
        snap.forEach(d => {
          const data = d.data();
          const sNum = data.shipmentNumber || data.orderNumber || d.id;
          if (sNum) {
            shipmentsToQuery.push(sNum);
            orderMap[sNum] = { id: d.id, uid: reqUserId, data };
          }
        });
      }
    }

    if (shipmentsToQuery.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد طلبات نشطة للمزامنة', updatedCount: 0, updates: [] });
    }

    // 3. Query Jenni API in chunks of 100
    const updatesList: Array<{
      shipmentNumber: string;
      newStatus: string;
      deliveryStatus: string;
      deliveryNote: string;
      jenniShipmentId: string;
    }> = [];

    let updatedCount = 0;
    const chunkSize = 100;
    
    for (let i = 0; i < shipmentsToQuery.length; i += chunkSize) {
      const chunk = shipmentsToQuery.slice(i, i + chunkSize);
      
      const queryRes = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_numbers: chunk })
      });

      const queryData = await queryRes.json();
      if (!queryRes.ok || !queryData.success) {
        console.error("Almasar API Query Error for chunk", i, ":", queryData);
        return NextResponse.json({ success: false, message: 'فشل الاستعلام من شركة التوصيل (الحد الأقصى أو خطأ داخلي)', details: queryData }, { status: 500 });
      }

      // 4. Collect updates and save to DB
      if (queryData.shipments && queryData.shipments.length > 0) {
        for (const shipment of queryData.shipments) {
          let newStatus = '';
          const step = (shipment.current_step || shipment.action_code || '').toUpperCase();
          
          if (step === 'DELIVERED' || step === 'SUCCESSFUL_DELIVERY' || step === 'SUCCESSFUL_DELIVERY_WITH_AMOUNT_CHANGE' || step === 'PARTIAL_DELIVERY') {
            newStatus = 'delivered';
          } else if (step === 'RETURNED' || step.startsWith('RTO_') || step === 'RETURN_TO_STORE' || step === 'RETURNED_WITH_AGENT') {
            newStatus = 'returned';
          } else if (step === 'OFD' || step === 'OUT_FOR_DELIVERY') {
            newStatus = 'ofd';
          } else if (step === 'POSTPONED') {
            newStatus = 'postponed';
          }

          const resolvedShipmentId = String(shipment.shipment_id || shipment.id || '');
          const shipmentNumber = shipment.shipment_number;

          // Add to returned updates list
          updatesList.push({
            shipmentNumber,
            newStatus,
            deliveryStatus: shipment.current_step || '',
            deliveryNote: shipment.note || '',
            jenniShipmentId: resolvedShipmentId
          });

          // Server-side client SDK update fallback (if orderMap was populated)
          const orderInfo = orderMap[shipmentNumber];
          if (orderInfo) {
            const currentData = orderInfo.data;
            if (currentData) {
              const targetStatus = newStatus || currentData.status;
              const statusChanged = currentData.status !== targetStatus;
              const missingIds = !currentData.jenniShipmentId || !currentData.shipmentId;
              const detailsChanged = currentData.deliveryStatus !== shipment.current_step || currentData.deliveryNote !== (shipment.note || '');

              if (statusChanged || missingIds || detailsChanged) {
                const updateData = {
                  status: targetStatus,
                  deliveryStatus: shipment.current_step || '',
                  deliveryNote: shipment.note || '',
                  shipmentId: shipmentNumber || orderInfo.id,
                  jenniShipmentId: resolvedShipmentId,
                  updatedAt: new Date()
                };

                try {
                  const orderRef = doc(db, 'users', orderInfo.uid, 'orders', orderInfo.id);
                  await updateDoc(orderRef, updateData);
                  updatedCount++;
                } catch (e) {
                  console.warn("Server-side client SDK update failed:", e);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `تمت المزامنة وتحديث ${updatedCount} طلبات`, 
      updatedCount,
      updates: updatesList
    });
  } catch (err: any) {
    console.error('Sync API Error:', err);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي أثناء المزامنة' }, { status: 500 });
  }
}
