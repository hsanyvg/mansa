const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function listUsers() {
  const usersColl = db.collection('users');
  const snap = await usersColl.get();
  console.log(`Total users in system: ${snap.size}`);
  for (const doc of snap.docs) {
    console.log(`User ID: ${doc.id}`);
    const intSnap = await doc.ref.collection('integrations').doc('delivery').get();
    if (intSnap.exists) {
      console.log(`  - Has integration credentials:`, intSnap.data());
    } else {
      console.log(`  - No integration credentials.`);
    }
  }
}

listUsers().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
