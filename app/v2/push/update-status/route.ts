import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // جلب بيانات الربط من قاعدة البيانات للتحقق من الهوية
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await getDoc(integrationRef);

    if (!integrationSnap.exists()) {
      return NextResponse.json({ success: false, message: 'Delivery integration not configured' }, { status: 401 });
    }

    const integrationData = integrationSnap.data();
    const storedSystemCode = integrationData.systemCode;
    const storedUsername = integrationData.username;
    const storedPassword = integrationData.password;

    // التحقق من رمز النظام (System Code)
    if (storedSystemCode && body.system_code !== storedSystemCode) {
      return NextResponse.json({ success: false, message: 'Invalid system code' }, { status: 401 });
    }

    // التحقق من اسم المستخدم وكلمة المرور (Basic Auth)
    let authorized = false;
    if (storedUsername && storedPassword) {
      const authHeader = req.headers.get('Authorization');
      let reqUsername = '';
      let reqPassword = '';

      if (authHeader && authHeader.startsWith('Basic ')) {
        try {
          const base64Credentials = authHeader.substring(6);
          const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
          const colonIndex = decodedCredentials.indexOf(':');
          if (colonIndex !== -1) {
            reqUsername = decodedCredentials.substring(0, colonIndex);
            reqPassword = decodedCredentials.substring(colonIndex + 1);
          }
        } catch (err) {
          console.error('Failed to parse Basic Auth header:', err);
        }
      } else if (body.username && body.password) {
        // دعم التحقق في حال إرسالهم داخل الـ body مباشرة
        reqUsername = body.username;
        reqPassword = body.password;
      }

      if (reqUsername === storedUsername && reqPassword === storedPassword) {
        authorized = true;
      }
    } else {
      // إذا لم تكن الإعدادات مدخلة في النظام بعد، نسمح بالمرور للتسهيل
      authorized = true;
    }

    if (!authorized) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Invalid username or password' }, { status: 401 });
    }

    const updates = body.updates || [];
    let processedCount = 0;

    for (const update of updates) {
      const orderId = update.external_id || update.external_shipment_id || update.shipment_number;
      
      if (!orderId) {
        console.log('Skipping update, no external_id found:', update);
        continue;
      }

      // تحديد الحالة الجديدة في نظامنا بناءً على الـ action_code
      let newStatus = 'shipped'; // الافتراضي (تم الشحن / قيد التوصيل)
      
      if (update.action_code === 'SUCCESSFUL_DELIVERY' || update.current_step === 'DELIVERED') {
        newStatus = 'delivered'; // مكتمل / مستلم
      } else if (update.action_code === 'RETURNED_WITH_AGENT' || update.action_code === 'RETURNED') {
        newStatus = 'returned'; // راجع
      } else if (update.action_code === 'POSTPONED') {
        newStatus = 'shipped'; // مؤجل (يبقى تحت الشحن)
      }

      try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
          status: newStatus,
          deliveryStatus: update.action_code || update.current_step,
          deliveryNote: update.note || '',
          deliveryAmount: update.amount_iqd,
          shipmentNumber: update.shipment_number,
          shipmentId: update.shipment_id,
          updatedAt: serverTimestamp()
        });
        processedCount++;
      } catch (docErr) {
        console.error(`Failed to update order ${orderId}:`, docErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} update(s)`,
      received_count: processedCount
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error while processing webhook' }, 
      { status: 500 }
    );
  }
}
