const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkLeft() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const snap = await ordersRef.where('status', '==', 'shipped').get();
  
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.shipmentCompany === 'المسرة' || data.shipmentCompany === 'Jenni Logistics') {
      const date = data.updatedAt ? data.updatedAt.toDate() : new Date(0);
      if (date >= todayStart) {
        count++;
      }
    }
  });

  console.log(`Orders still shipped for Masarra today: ${count}`);
}

checkLeft().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
