const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findOrder() {
  const usersSnap = await db.collection('users').get();
  let found = false;
  for (const userDoc of usersSnap.docs) {
    const ordersSnap = await db.collection('users').doc(userDoc.id).collection('orders').get();
    for (const doc of ordersSnap.docs) {
        const data = doc.data();
        if (doc.id === '109022' || doc.id === '109075' || 
            String(data.orderNumber) === '109022' || String(data.orderNumber) === '109075' ||
            String(data.id) === '109022' || String(data.id) === '109075') {
            console.log(`Found in user ${userDoc.id}, docId: ${doc.id}`);
            console.log('Data:', data);
            found = true;
        }
    }
  }
  if (!found) console.log('Order not found anywhere!');
}

findOrder().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
