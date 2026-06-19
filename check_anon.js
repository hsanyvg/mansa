const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkAnonymous() {
  const userId = 'anonymous';
  console.log(`Querying orders for user: ${userId}`);
  
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  const snap = await ordersRef.where('isTest', '==', true).get();
  
  if (snap.empty) {
    console.log('No test orders found for anonymous user.');
    return;
  }
  
  console.log(`Found ${snap.size} test orders for anonymous.`);
}

checkAnonymous().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
