import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { adminDb, adminAuth } from "../../../../lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    // 1. Fetch Integration Settings to get the token
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await getDoc(integrationRef);

    if (!integrationSnap.exists()) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد ربط شركة التوصيل' }, { status: 400 });
    }

    const integrationData = integrationSnap.data();
    if (!integrationData.username || !integrationData.password) {
      return NextResponse.json({ success: false, message: 'بيانات الدخول لشركة التوصيل مفقودة' }, { status: 400 });
    }

    // Login to get token
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

    // 2. Query Firebase for active orders
    const activeStatuses = ['shipped', 'ofd', 'postponed'];
    const shipmentsToQuery: string[] = [];
    const orderMap: Record<string, { id: string, uid: string }> = {};

    if (adminAuth && adminDb) {
      const usersResult = await adminAuth.listUsers();
      for (const u of usersResult.users) {
         try {
           const userOrdersQuery = adminDb.collection('users').doc(u.uid).collection('orders').where('status', 'in', activeStatuses);
           const snap = await userOrdersQuery.get();
           snap.forEach(d => {
             const data = d.data();
             const sNum = data.shipmentNumber || data.orderNumber || d.id;
             if (sNum) {
               shipmentsToQuery.push(sNum);
               orderMap[sNum] = { id: d.id, uid: u.uid };
             }
           });
         } catch(e) {
           console.error('Error fetching orders for user', u.uid, e);
         }
      }
    }

    if (shipmentsToQuery.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد طلبات نشطة للمزامنة', updatedCount: 0 });
    }

    // 3. Query Jenni API in chunks of 100
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

      // 4. Update orders in Firebase
      if (queryData.shipments && queryData.shipments.length > 0) {
        for (const shipment of queryData.shipments) {
          const orderInfo = orderMap[shipment.shipment_number];
          if (!orderInfo) continue;

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

          const orderRef = doc(db, 'users', orderInfo.uid, 'orders', orderInfo.id);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const currentData = orderSnap.data();
            if (currentData) {
              const targetStatus = newStatus || currentData.status;
              const statusChanged = currentData.status !== targetStatus;
              const missingIds = !currentData.jenniShipmentId || !currentData.shipmentId;
              const detailsChanged = currentData.deliveryStatus !== shipment.current_step || currentData.deliveryNote !== (shipment.note || '');

              if (statusChanged || missingIds || detailsChanged) {
                const resolvedShipmentId = shipment.shipment_id || shipment.id || '';
                await updateDoc(orderRef, {
                  status: targetStatus,
                  deliveryStatus: shipment.current_step || '',
                  deliveryNote: shipment.note || '',
                  shipmentId: shipment.shipment_number || orderInfo.id,
                  jenniShipmentId: resolvedShipmentId,
                  updatedAt: new Date()
                });
                updatedCount++;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `تمت المزامنة وتحديث ${updatedCount} طلبات`, updatedCount });
  } catch (err: any) {
    console.error('Sync API Error:', err);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي أثناء المزامنة' }, { status: 500 });
  }
}
