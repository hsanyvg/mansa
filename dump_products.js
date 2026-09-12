const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const serviceAccount = require('./serviceAccountKey.json');
if (!getApps().length) { initializeApp({ credential: cert(serviceAccount) }); }
const db = getFirestore();
async function check() {
  const usersSnap = await db.collectionGroup('products').get();
  const arr = [];
  for (const p of usersSnap.docs) {
    const data = p.data();
    arr.push({id: p.id, name: data.name, stock: data.stock, reserved: data.reserved});
  }
  fs.writeFileSync('all_products.json', JSON.stringify(arr, null, 2));
  console.log('Saved', arr.length, 'products');
}
check().then(() => process.exit(0)).catch(console.error);
