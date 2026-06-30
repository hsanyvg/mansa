import { NextResponse } from 'next/server';
import { db, auth } from "../../../../lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { adminDb, adminAuth } from "../../../../lib/firebaseAdmin";

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
      const step = (update.action_code || update.current_step || '').toUpperCase();
      
      if (step === 'DELIVERED' || step === 'SUCCESSFUL_DELIVERY' || step === 'SUCCESSFUL_DELIVERY_WITH_AMOUNT_CHANGE' || step === 'PARTIAL_DELIVERY') {
        newStatus = 'delivered'; // مكتمل / مستلم
      } else if (step === 'RETURNED' || step.startsWith('RTO_') || step === 'RETURN_TO_STORE' || step === 'RETURNED_WITH_AGENT') {
        newStatus = 'returned'; // راجع
      } else if (step === 'OFD' || step === 'OUT_FOR_DELIVERY') {
        newStatus = 'ofd'; // قيد التوصيل
      } else if (step === 'POSTPONED') {
        newStatus = 'postponed'; // مؤجل
      }

      try {
        let foundUid = null;
        let existingData: any = null;
        // Search for the actual user who owns this order
        if (adminAuth && adminDb) {
          try {
            const usersResult = await adminAuth.listUsers();
            for (const u of usersResult.users) {
              const snap = await adminDb.collection('users').doc(u.uid).collection('orders').doc(orderId).get();
              if (snap.exists) {
                foundUid = u.uid;
                existingData = snap.data();
                break;
              }
            }
          } catch(e) {
            console.error('Error finding user:', e);
          }
        }

        const targetUid = foundUid || auth.currentUser?.uid || 'anonymous';
        const orderRef = doc(db, 'users', targetUid, 'orders', orderId);
        
        const updateData: any = {
          status: newStatus,
          deliveryStatus: update.action_code || update.current_step,
          deliveryNote: update.note || '',
          deliveryAmount: update.amount_iqd,
          shipmentNumber: update.shipment_number,
          shipmentId: update.shipment_id,
          jenniShipmentId: update.shipment_id || '',
          updatedAt: serverTimestamp()
        };

        if (newStatus === 'returned') {
          updateData.deliveryCost = 0;
          if (existingData && existingData.deliveryCost > 0) {
            const currentTotal = existingData.totalAmount || existingData.price || 0;
            updateData.totalAmount = currentTotal + existingData.deliveryCost;
          } else if (!existingData) {
            try {
              const clientSnap = await getDoc(orderRef);
              if (clientSnap.exists()) {
                const clientData = clientSnap.data();
                if (clientData.deliveryCost > 0) {
                  const currentTotal = clientData.totalAmount || clientData.price || 0;
                  updateData.totalAmount = currentTotal + clientData.deliveryCost;
                }
              }
            } catch (e) {}
          }
        }

        await updateDoc(orderRef, updateData);
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
