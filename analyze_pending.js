const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function analyzePending() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const snap = await ordersRef.where('status', '==', 'pending').get();
  
  let total = 0;
  let testCount = 0;
  let hasTestPrefix = 0;
  
  snap.forEach(doc => {
    const data = doc.data();
    total++;
    if (data.isTest) testCount++;
    if (data.orderNumber && String(data.orderNumber).startsWith('TEST-')) hasTestPrefix++;
  });

  console.log(`Total pending orders: ${total}`);
  console.log(`Pending with isTest: true: ${testCount}`);
  console.log(`Pending with orderNumber starting with TEST-: ${hasTestPrefix}`);
}

analyzePending().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
