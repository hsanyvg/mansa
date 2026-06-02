import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { orderId, shipmentId } = await req.json();

    if (!orderId || !shipmentId) {
      return NextResponse.json({ success: false, message: 'معرف الطلب أو الشحنة مفقود' }, { status: 400 });
    }

    // 1. Fetch Integration Settings
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await getDoc(integrationRef);

    if (!integrationSnap.exists()) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد ربط شركة التوصيل' }, { status: 400 });
    }

    const integrationData = integrationSnap.data();
    if (!integrationData.username || !integrationData.password) {
      return NextResponse.json({ success: false, message: 'بيانات الدخول لشركة التوصيل مفقودة' }, { status: 400 });
    }

    // 2. Login to get token
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

    // 3. Send DELETE request to Jenni API
    const deleteRes = await fetch(`https://almasara.jenni.delivery/api/v2/orders/${shipmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Handle both 200 OK and 204 No Content
    if (!deleteRes.ok) {
      const errorData = await deleteRes.json().catch(() => ({}));
      console.error('Jenni API Delete Error:', errorData);
      
      // If Jenni returns an error, it might be because it's already out for delivery or doesn't exist
      const errorMsg = errorData.message || 'لا يمكن إلغاء هذه الشحنة حالياً (قد تكون خرجت مع المندوب)';
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }

    // 4. Update order in Firebase to cancelled
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: 'cancelled',
      deliveryStatus: 'CANCELLED_API',
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true, message: 'تم إلغاء الشحنة بنجاح من شركة التوصيل ومن النظام' });
  } catch (err: any) {
    console.error('Cancel API Error:', err);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي أثناء عملية الإلغاء' }, { status: 500 });
  }
}
