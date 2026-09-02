const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findLog() {
  console.log('Searching for webhook log with 109111...');
  
  // check global logs
  const globalSnap = await db.collection('webhook_logs').get();
  for (const doc of globalSnap.docs) {
    const data = doc.data();
    if (data.payload && data.payload.receiptNumber == '109111') {
      console.log('Found in global logs:', JSON.stringify(data, null, 2));
      return;
    }
  }

  // check users logs
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const userLogs = await db.collection('users').doc(userDoc.id).collection('webhook_logs').get();
    for (const doc of userLogs.docs) {
      const data = doc.data();
      if (data.payload && data.payload.receiptNumber == '109111') {
        console.log(`Found in user ${userDoc.id} logs:`, JSON.stringify(data, null, 2));
        return;
      }
    }
  }
  
  console.log('Not found anywhere.');
}

findLog().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
