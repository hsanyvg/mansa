import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const systemCode = process.env.JENNI_SYSTEM_CODE;
    if (systemCode && body.system_code !== systemCode) {
      return NextResponse.json({ success: false, message: 'Invalid system code' }, { status: 401 });
    }

    const updates = body.updates || [];
    let processedCount = 0;

    for (const update of updates) {
      const orderId = update.external_id || update.external_shipment_id;
      
      if (!orderId) {
        console.log('Skipping update, no external_id found:', update);
        continue;
      }

      // تحديد الحالة الجديدة في نظامنا بناءً على الـ action_code
      let newStatus = 'قيد التوصيل'; // الافتراضي
      
      if (update.action_code === 'SUCCESSFUL_DELIVERY' || update.current_step === 'DELIVERED') {
        newStatus = 'مستلم';
      } else if (update.action_code === 'RETURNED_WITH_AGENT' || update.action_code === 'RETURNED') {
        newStatus = 'راجع';
      } else if (update.action_code === 'POSTPONED') {
        newStatus = 'مؤجل';
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
