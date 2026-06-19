const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteOrders() {
  console.log('Querying collection group for test orders...');
  const ordersSnap = await db.collectionGroup('orders').where('isTest', '==', true).get();
  
  if (ordersSnap.empty) {
    console.log('No test orders found.');
    return;
  }
  
  let deletedCount = 0;
  let batch = db.batch();
  
  ordersSnap.forEach(doc => {
    batch.delete(doc.ref);
    deletedCount++;
    if (deletedCount % 500 === 0) {
      batch.commit();
      batch = db.batch();
    }
  });
  
  if (deletedCount % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`Deleted ${deletedCount} test orders.`);
}

deleteOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
