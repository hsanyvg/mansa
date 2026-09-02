const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkSpecificOrders() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const ids = ['107073', '107072', '107071', '107070', '107069'];
  
  for (const id of ids) {
    const doc = await ordersRef.doc(id).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`Order ${id}:`);
      console.log(`  employeeName: ${data.employeeName}`);
      console.log(`  bookingEmployeeName: ${data.bookingEmployeeName}`);
      console.log(`  employeeId: ${data.employeeId}`);
      console.log(`  source: ${data.source || 'N/A'}`);
      console.log(`  client_ip: ${data.client_ip || 'N/A'}`);
    } else {
      console.log(`Order ${id} not found.`);
    }
  }
}

checkSpecificOrders();
