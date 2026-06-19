const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkOrders() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const snap = await ordersRef.where('status', '==', 'shipped').get();
  
  let masarraCount = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.shipmentCompany === 'المسرة' || data.shipmentCompany === 'Jenni Logistics') {
      masarraCount++;
    }
  });

  console.log(`Orders still shipped for Masarra: ${masarraCount}`);
}

checkOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
