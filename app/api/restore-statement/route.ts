import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const deletedIds = [
  "100519", "100522", "100565", "100569", "100592", "100594", "100601", "100607", "100608", "100613",
  "100617", "100633", "100634", "100635", "100636", "100637", "100638", "100639", "100641", "100642",
  "100643", "100645", "100646", "100647", "100649", "100651", "100653", "100654", "100655", "100656",
  "100657", "100658", "100659", "100660", "100661", "100662", "100663", "100665", "100667", "100668",
  "100669", "100670", "100671", "100673", "100674", "100675", "100676", "100677", "100678", "100680",
  "100681", "100682", "100683", "100684", "100685", "100688", "100689", "100690", "100691", "100692",
  "100693", "100695", "100696", "100700", "100701", "100703", "100704", "100705", "100706", "100711",
  "100713", "100714", "100715", "100716", "100717", "100719", "100720", "100721", "100722", "100724",
  "100725", "100726", "100727", "100730", "100733", "100734", "100735", "100736", "100738", "100739",
  "100741", "100742", "100743", "100744", "100745", "100746", "100747", "100748", "100749", "100750",
  "100751", "100753", "100754", "100755", "100758", "100760", "100761", "100764", "100766", "100767",
  "100768", "100771", "100772", "100774", "100775", "100776", "100777", "100779", "100780", "100781",
  "100782", "100783", "100786", "100788", "100789", "100790", "100792", "100793", "100794", "100796",
  "100797", "100800", "100803", "100804", "100805", "100808", "100809", "100810", "100811", "100813",
  "100817", "100819", "100820", "100821", "100822", "100823", "100824", "100825", "100826", "100827",
  "100832", "100834", "100835", "100837", "100840", "100841", "100842", "100843", "100848", "100849",
  "100851", "100853", "100856", "100858", "100859", "100860", "100861", "100863", "100865", "100867",
  "100868", "100870", "100873", "100874", "100875", "100876", "100879", "100883", "100884", "100886",
  "100887", "100888"
];

export async function GET() {
  try {
    const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';

    // 1. Get credentials from default_tenant (or the system settings)
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await fetch(`https://firestore.googleapis.com/v1/projects/management-easy-order/databases/(default)/documents/users/default_tenant/integrations/delivery`);
    if (!integrationSnap.ok) {
      return NextResponse.json({ success: false, message: 'Failed to fetch integration data from Firestore API' });
    }
    const integrationDataJson = await integrationSnap.json();
    const fields = integrationDataJson.fields;
    const username = fields.username?.stringValue;
    const password = fields.password?.stringValue;

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Credentials missing' });
    }

    // 2. Login to Jenni API
    console.log("Attempting to login to Jenni API with user:", username);
    const loginRes = await fetch('https://almasara.jenni.delivery/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const loginData = await loginRes.json();
    console.log("Jenni login response:", loginData);
    if (!loginRes.ok || !loginData.token) {
      return NextResponse.json({ success: false, message: 'Jenni Login failed', details: loginData });
    }
    const token = loginData.token.replace('Bearer ', '').trim();

    // 3. Query shipments in chunks
    const shipments = [];
    const chunkSize = 100;
    for (let i = 0; i < deletedIds.length; i += chunkSize) {
      const chunk = deletedIds.slice(i, i + chunkSize);
      console.log(`Querying Jenni API for chunk starting at ${i} with ${chunk.length} IDs...`);
      const queryRes = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_numbers: chunk })
      });
      const queryData = await queryRes.json();
      console.log(`Jenni query response for chunk ${i}:`, JSON.stringify(queryData).substring(0, 1000));
      if (queryRes.ok && queryData.success && queryData.shipments) {
        shipments.push(...queryData.shipments);
      }
    }
    console.log(`Total shipments successfully fetched from Jenni API: ${shipments.length}`);

    // 4. Re-create orders in Firestore as unsettled Delivered
    let restoredCount = 0;
    for (const shipment of shipments) {
      const orderId = String(shipment.external_id || shipment.external_shipment_id || shipment.shipment_number);
      if (!orderId || orderId === 'undefined') continue;

      const orderRef = doc(db, 'users', userId, 'orders', orderId);
      const totalAmount = Number(shipment.amount_iqd || shipment.price || 0);
      const deliveryCost = Number(shipment.delivery_amount || shipment.delivery_cost || 0);

      const orderData = {
        customerName: shipment.receiver_name || shipment.customer_name || 'غير معروف',
        customerPhone: shipment.receiver_phone_1 || shipment.customer_phone || shipment.phone || '',
        governorate: shipment.governorate_name || shipment.governorate || '---',
        region: shipment.city || shipment.region || '---',
        totalAmount: totalAmount - deliveryCost, // Net amount of products
        deliveryCost: deliveryCost, // Delivery cost
        status: 'delivered', // Delivered status
        is_settled: false, // Unsettled (Delivered without being settled)
        paymentStatus: '', // Unsettled
        shipmentNumber: shipment.shipment_number || '',
        shipmentId: String(shipment.shipment_id || shipment.id || ''),
        jenniShipmentId: String(shipment.shipment_id || shipment.id || ''),
        isArchived: false,
        date: shipment.created_at ? new Date(shipment.created_at) : new Date(),
        updatedAt: new Date()
      };

      await setDoc(orderRef, orderData, { merge: true });
      restoredCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${restoredCount} orders!`,
      restoredCount
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: error.message || 'Error occurred' }, { status: 500 });
  }
}
