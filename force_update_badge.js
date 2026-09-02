const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function forceUpdate() {
  console.log('Fetching from collectionGroup...');
  const ordersSnap = await db.collectionGroup('orders').limit(10).get();
  
  if (ordersSnap.empty) {
      console.log('NO ORDERS FOUND AT ALL!');
      return;
  }

  for (const doc of ordersSnap.docs) {
    console.log(`Setting flag on order ${doc.id}`);
    await doc.ref.update({ updatedBy: 'albarq_webhook' });
  }
  console.log('Successfully updated flags for testing!');
}

forceUpdate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
