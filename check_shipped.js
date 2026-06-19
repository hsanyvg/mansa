const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkShipped() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const snap = await ordersRef.where('status', '==', 'shipped').get();
  
  console.log(`Total shipped orders: ${snap.size}`);
}

checkShipped().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
