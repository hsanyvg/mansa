const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findOrder() {
  const receiptStr = "109022";
  const receiptNum = 109022;
  
  console.log('Searching for string ID...');
  const snap1 = await db.collectionGroup('orders').where('id', '==', receiptStr).get();
  console.log('Found (id == string):', snap1.size);
  
  console.log('Searching for string orderNumber...');
  const snap2 = await db.collectionGroup('orders').where('orderNumber', '==', receiptStr).get();
  console.log('Found (orderNumber == string):', snap2.size);

  console.log('Searching for number orderNumber...');
  const snap3 = await db.collectionGroup('orders').where('orderNumber', '==', receiptNum).get();
  console.log('Found (orderNumber == number):', snap3.size);

  if (snap3.size > 0) {
      console.log('Sample Data:', snap3.docs[0].data());
  }
}

findOrder().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
