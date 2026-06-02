import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

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
    const activeStatuses = ['shipped', 'ofd'];
    const shipmentsToQuery: string[] = [];
    const orderMap: Record<string, string> = {};

    // Firestore query requires multiple where clauses or fetching all and filtering
    // To be safe and avoid index issues, fetch all active orders
    const q = query(collection(db, 'orders'), where('status', 'in', activeStatuses));
    const snap = await getDocs(q);

    snap.forEach(d => {
      const data = d.data();
      const sNum = data.shipmentNumber || data.orderNumber || d.id;
      if (sNum) {
        shipmentsToQuery.push(sNum);
        orderMap[sNum] = d.id;
      }
    });

    if (shipmentsToQuery.length === 0) {
      return NextResponse.json({ success: true, message: 'لا توجد طلبات نشطة للمزامنة', updatedCount: 0 });
    }

    // 3. Query Jenni API
    const queryRes = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ shipment_numbers: shipmentsToQuery })
    });

    const queryData = await queryRes.json();
    if (!queryRes.ok || !queryData.success) {
      return NextResponse.json({ success: false, message: 'فشل الاستعلام من شركة التوصيل' }, { status: 500 });
    }

    let updatedCount = 0;
    
    // 4. Update orders in Firebase
    for (const shipment of queryData.shipments) {
      const orderId = orderMap[shipment.shipment_number];
      if (!orderId) continue;

      let newStatus = '';
      if (shipment.current_step === 'DELIVERED') {
        newStatus = 'delivered';
      } else if (shipment.current_step === 'RETURNED' || (shipment.current_step && shipment.current_step.startsWith('RTO_'))) {
        newStatus = 'returned';
      } else if (shipment.current_step === 'OFD') {
        newStatus = 'ofd';
      }

      if (newStatus) {
        const orderRef = doc(db, 'orders', orderId);
        // We read the doc to see if the status actually changed to avoid unnecessary writes
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists() && orderSnap.data().status !== newStatus) {
          await updateDoc(orderRef, {
            status: newStatus,
            deliveryStatus: shipment.current_step,
            deliveryNote: shipment.note || '',
            shipmentId: shipment.shipment_id,
            updatedAt: new Date()
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, message: `تمت المزامنة وتحديث ${updatedCount} طلبات`, updatedCount });
  } catch (err: any) {
    console.error('Sync API Error:', err);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي أثناء المزامنة' }, { status: 500 });
  }
}
