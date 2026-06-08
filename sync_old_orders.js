// no dotenv
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc, getDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyBdnfIwyrDt3BOv875HsofMASq6ftzZzls",
  projectId: "management-easy-order"
});
const db = getFirestore(app);

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJhdXRob3JpdGllcyI6W3siYXV0aG9yaXR5IjoiUk9MRV9OZXdDYXNlc0J5Q3VzdG9tZXIifSx7ImF1dGhvcml0eSI6IlJPTEVfdXBkYXRlY2FzZSJ9LHsiYXV0aG9yaXR5IjoiUk9MRV9NQVNURVJDVVNUT01FUiJ9XSwidXNlcklkIjozNDU2NywiYnJhbmNoSWQiOjk2LCJicmFuY2hOYW1lIjoi2LTYsdmD2Kkg2KfZhNmF2LPYsdipIC0g2KfZhNmB2LHYuSDYp9mE2LHYptmK2LPZiiAiLCJ1c2VyTmFtZSI6IjA3NzY4Nzg5ODgwIiwibWFpbkJyYW5jaCI6ZmFsc2UsInVzZXJSYW5rIjoiTUFTVEVSQ1VTVE9NRVIiLCJjb21wYW55TmFtZSI6IkFMTUFTQVJBIiwibWFzdGVyQ3VzdG9tZXJJZCI6Nzg5LCJzdWIiOiIwNzc2ODc4OTg4MCIsImlhdCI6MTc4MDQyNDAyNywiZXhwIjoxNzgwNTEwNDI3fQ.rFD0lVhGMLPUoZHMZe31HB4JNnrWhTO2enYBuOTpJbA';

async function syncOrders() {
  console.log("Fetching shipped orders from database...");
  const q = query(collection(db, 'orders'), where('status', '==', 'shipped'));
  const snap = await getDocs(q);
  
  const shipmentsToQuery = [];
  const orderMap = {};

  snap.forEach(d => {
    const data = d.data();
    // Use shipmentNumber if available, otherwise fallback to order id
    const sNum = data.shipmentNumber || data.orderNumber || d.id;
    if (sNum) {
      shipmentsToQuery.push(sNum);
      orderMap[sNum] = d.id;
    }
  });

  if (shipmentsToQuery.length === 0) {
    console.log("No shipped orders found.");
    process.exit(0);
  }

  console.log(`Found ${shipmentsToQuery.length} shipped orders. Querying Jenni API...`);

  try {
    const res = await fetch('https://almasara.jenni.delivery/api/v2/shipments/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ shipment_numbers: shipmentsToQuery })
    });

    const data = await res.json();
    if (!data.success) {
      console.error("Jenni API query failed:", data.message);
      process.exit(1);
    }

    let updatedCount = 0;
    for (const shipment of data.shipments) {
      const orderId = orderMap[shipment.shipment_number];
      if (!orderId) continue;

      let newStatus = 'shipped';
      if (shipment.current_step === 'DELIVERED') {
        newStatus = 'delivered';
      } else if (shipment.current_step === 'RETURNED' || (shipment.current_step && shipment.current_step.startsWith('RTO_'))) {
        newStatus = 'returned';
      } else if (shipment.current_step === 'OFD') {
        newStatus = 'ofd';
      }

      console.log(`Order ${orderId} (${shipment.shipment_number}) is currently: ${shipment.current_step} - Mapping to: ${newStatus}`);

      const orderRef = doc(db, 'orders', orderId);
      const docSnap = await getDoc(orderRef);
      const currentData = docSnap.data();
      
      if (true) {
        await updateDoc(orderRef, {
          status: newStatus,
          deliveryStatus: shipment.current_step,
          deliveryNote: shipment.note || '',
          shipmentId: shipment.shipment_number,
          jenniShipmentId: shipment.shipment_id || shipment.id || shipment.shipment_number,
          updatedAt: new Date()
        });
        updatedCount++;
      }
    }

    console.log(`Successfully synced ${updatedCount} orders.`);
    process.exit(0);
  } catch (err) {
    console.error("Error during sync:", err);
    process.exit(1);
  }
}

syncOrders();
