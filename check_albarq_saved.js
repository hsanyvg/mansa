const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkAlbarqOrders() {
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const ordersSnap = await db.collection('users').doc(userDoc.id).collection('orders').where('shipmentCompany', '==', 'Albarq Logistics').limit(3).get();
    ordersSnap.forEach(doc => {
        console.log(`Order ${doc.id}: albarqReceiptNumber: ${doc.data().albarqReceiptNumber}, orderNumber: ${doc.data().orderNumber}`);
    });
  }
}

checkAlbarqOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
