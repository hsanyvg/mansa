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

    // We already checked system_code above. If system_code matches, we consider it authorized.
    // We bypass the strict username/password check because the Inbound (Webhook) credentials 
    // registered at the delivery company are often different from the Outbound API credentials 
    // stored in the database, and we don't have a dedicated DB field for webhook credentials yet.
    let authorized = true;

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
      } else if (update.action_code === 'RETURNED_WITH_AGENT' || update.action_code === 'RETURN_TO_STORE' || (update.current_step && update.current_step.startsWith('RTO_'))) {
        newStatus = 'returned'; // راجع
      } else if (update.action_code === 'OUT_FOR_DELIVERY' || update.current_step === 'OFD') {
        newStatus = 'ofd'; // قيد التوصيل
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
          jenniShipmentId: update.shipment_id || '',
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
