const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkLogs() {
  console.log('--- Global Webhook Logs ---');
  const globalLogs = await db.collection('webhook_logs').orderBy('timestamp', 'desc').limit(5).get();
  globalLogs.forEach(doc => {
    console.log(doc.id, JSON.stringify(doc.data(), null, 2));
  });

  console.log('\n--- User Webhook Logs ---');
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const userLogs = await db.collection('users').doc(userDoc.id).collection('webhook_logs').orderBy('timestamp', 'desc').limit(5).get();
    if (!userLogs.empty) {
        console.log(`User: ${userDoc.id}`);
        userLogs.forEach(doc => {
            console.log(doc.id, JSON.stringify(doc.data(), null, 2));
        });
    }
  }
}

checkLogs().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
