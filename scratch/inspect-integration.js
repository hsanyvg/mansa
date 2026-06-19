const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspect() {
  const tenants = ['default_tenant', 'guAXkcygceeBkpwtFdf1n8O3dRX2'];
  for (const t of tenants) {
    const docRef = db.collection('users').doc(t).collection('integrations').doc('delivery');
    const snap = await docRef.get();
    if (snap.exists) {
      console.log(`Tenant: ${t} - EXISTS! Data:`, snap.data());
    } else {
      console.log(`Tenant: ${t} - DOES NOT EXIST!`);
    }
  }
}

inspect().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
