const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function listMappings() {
  const coll = db.collection('employee_mappings');
  const snap = await coll.get();
  console.log(`Total mappings: ${snap.size}`);
  snap.forEach(d => {
    console.log(`Mapping ID: ${d.id} ->`, d.data());
  });
}

listMappings().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
