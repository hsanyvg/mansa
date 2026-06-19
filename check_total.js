const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkTotalOrders() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const snap = await ordersRef.get();
  
  let statuses = {};
  snap.forEach(doc => {
    const data = doc.data();
    statuses[data.status] = (statuses[data.status] || 0) + 1;
  });

  console.log(`Total orders: ${snap.size}`);
  console.log('Status breakdown:', statuses);
}

checkTotalOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
