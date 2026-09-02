const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findAnyOrder() {
  console.log('Finding a sample order...');
  const snap = await db.collectionGroup('orders').limit(1).get();
  if (snap.size > 0) {
      console.log('Sample Data:', snap.docs[0].data());
  } else {
      console.log('No orders found in the entire DB?!');
  }
}

findAnyOrder().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
