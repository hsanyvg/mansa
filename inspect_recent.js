const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspectOrders() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  // Get the most recently updated orders
  const snap = await ordersRef.orderBy('updatedAt', 'desc').limit(100).get();
  
  let count = 1;
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`${count}. ID: ${doc.id}, Status: ${data.status}, Company: ${data.shipmentCompany}, Date: ${data.updatedAt?.toDate()}`);
    count++;
  });
}

inspectOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
