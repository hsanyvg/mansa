const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:\\Users\\Hasan\\.gemini\\antigravity\\scratch\\inventory-system\\serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function restore7() {
  const idsToRestore = ['105391', '105392', '105393', '105394', '105395', '105396', '105397'];
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  
  const batch = db.batch();
  let count = 0;
  
  for (const id of idsToRestore) {
    const docRef = db.collection('users').doc(userId).collection('orders').doc(id);
    batch.update(docRef, { isDeleted: FieldValue.delete() });
    count++;
  }
  
  await batch.commit();
  console.log(`Successfully restored ${count} orders: ${idsToRestore.join(', ')}`);
}

restore7().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
