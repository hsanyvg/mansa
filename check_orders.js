const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkOrders() {
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const ordersSnap = await db.collection('users').doc(userDoc.id).collection('orders').get();
    let shippedCount = 0;
    let pendingCount = 0;
    ordersSnap.forEach(doc => {
      const data = doc.data();
      if (data.status === 'shipped') shippedCount++;
      if (data.status === 'pending') pendingCount++;
    });
    console.log(`User ${userDoc.id}: Total ${ordersSnap.size} orders. Shipped: ${shippedCount}, Pending: ${pendingCount}`);
  }
}

checkOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
