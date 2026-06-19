const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteOrders() {
  const userId = 'nCgBihLqKOUkicrUONt5x1nIfv32';
  console.log(`Querying orders for user: ${userId}`);
  
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  const snap = await ordersRef.where('isTest', '==', true).get();
  
  if (snap.empty) {
    console.log('No test orders found for this user.');
    return;
  }
  
  let deletedCount = 0;
  let batch = db.batch();
  
  snap.forEach(doc => {
    batch.delete(doc.ref);
    deletedCount++;
    if (deletedCount % 400 === 0) {
      batch.commit();
      batch = db.batch();
    }
  });
  
  if (deletedCount % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`Successfully deleted ${deletedCount} test orders.`);
}

deleteOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
