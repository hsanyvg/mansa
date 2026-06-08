import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { orderId, shipmentId, skipDbUpdate } = await req.json();

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'معرف الطلب مفقود' }, { status: 400 });
    }

    // 1. Fetch Order Document from Firestore to get the true jenniShipmentId
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return NextResponse.json({ success: false, message: 'الطلب غير موجود في قاعدة البيانات' }, { status: 404 });
    }

    const orderData = orderSnap.data();
    // Prioritize the correct internal ID stored in Firestore, fallback to client-provided shipmentId
    let targetShipmentId = orderData.jenniShipmentId || orderData.shipmentId || orderData.shipmentNumber || shipmentId;

    // 2. Fetch Integration Settings
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await getDoc(integrationRef);

    if (!integrationSnap.exists()) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد ربط شركة التوصيل' }, { status: 400 });
    }

    const integrationData = integrationSnap.data();
    if (!integrationData.username || !integrationData.password) {
      return NextResponse.json({ success: false, message: 'بيانات الدخول لشركة التوصيل مفقودة' }, { status: 400 });
    }

    // 3. Login to get token
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

    // Self-healing: if targetShipmentId is missing, is a shipment/order number, or is not a pure numeric database ID, query Jenni API to resolve it
    const isNumericId = targetShipmentId && /^\d+$/.test(String(targetShipmentId));
    const isShipmentNumber = targetShipmentId === orderData.orderNumber || targetShipmentId === orderData.shipmentNumber || targetShipmentId === orderData.shipmentId || targetShipmentId === orderId;

    if (!targetShipmentId || !isNumericId || isShipmentNumber) {
      const searchNumber = orderData.shipmentNumber || orderData.shipmentId || orderData.orderNumber || orderId;
      console.log(`targetShipmentId "${targetShipmentId}" is not a valid Jenni database ID. Querying Jenni API with shipment number "${searchNumber}" to resolve...`);
      try {
        const queryRes = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ shipment_numbers: [String(searchNumber)] })
        });
        const queryData = await queryRes.json();
        if (queryRes.ok && queryData.success && queryData.shipments?.length > 0) {
          const foundShip = queryData.shipments[0];
          const resolvedId = foundShip.shipment_id || foundShip.id;
          if (resolvedId) {
            console.log(`Resolved targetShipmentId to: ${resolvedId}. Updating Firestore...`);
            targetShipmentId = String(resolvedId);
            await updateDoc(orderRef, {
              jenniShipmentId: resolvedId,
              shipmentId: foundShip.shipment_number || searchNumber
            });
          }
        } else {
          console.warn(`Query did not return shipment for number: ${searchNumber}. Response:`, queryData);
        }
      } catch (err) {
        console.error('Failed to self-heal shipment ID:', err);
      }
    }

    if (!targetShipmentId) {
      return NextResponse.json({ success: false, message: 'معرف الشحنة غير متوفر في النظام' }, { status: 400 });
    }

    // 3. Send DELETE request to Jenni API
    const deleteRes = await fetch(`https://almasara.jenni.delivery/api/v2/orders/${targetShipmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Handle both 200 OK and 204 No Content
    if (!deleteRes.ok) {
      const errorData = await deleteRes.json().catch(() => ({}));
      console.error('Jenni API Delete Error:', errorData);
      
      const errorMsg = errorData.message || errorData.error || '';
      const isNotFound = errorMsg.toLowerCase().includes('not found') || 
                         errorMsg.toLowerCase().includes('لا يوجد') || 
                         deleteRes.status === 404;
      
      if (!isNotFound) {
        // If Jenni returns an actual error (e.g., shipment locked, out for delivery), block the cancellation
        const finalMsg = errorMsg || 'لا يمكن إلغاء هذه الشحنة حالياً (قد تكون خرجت مع المندوب)';
        return NextResponse.json({ success: false, message: finalMsg }, { status: 400 });
      }
      
      console.log(`Shipment was already deleted or not found on Jenni (${targetShipmentId}). Proceeding to cancel locally in Firestore.`);
    }

    // 4. Update order in Firebase to cancelled
    if (!skipDbUpdate) {
      await updateDoc(orderRef, {
        status: 'cancelled',
        deliveryStatus: 'CANCELLED_API',
        updatedAt: new Date()
      });
    }

    return NextResponse.json({ success: true, message: 'تم إلغاء الشحنة بنجاح من شركة التوصيل ومن النظام' });
  } catch (err: any) {
    console.error('Cancel API Error:', err);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي أثناء عملية الإلغاء' }, { status: 500 });
  }
}
