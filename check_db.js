const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  console.log('Connecting to Firestore...');
  const usersRef = db.collection('users');
  const snap = await usersRef.limit(5).get();
  console.log('Users found:', snap.size);
  snap.forEach(doc => {
    console.log('User ID:', doc.id);
  });
}

check().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
