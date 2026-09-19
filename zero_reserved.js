const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}
const db = getFirestore();

async function fixStuckReserved() {
  console.log('Fixing stuck reserved stock...');
  const uid = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const productsRef = db.collection('users').doc(uid).collection('products');
  const productsSnap = await productsRef.get();
  
  let updatedCount = 0;
  const batch = db.batch();
  let opsInBatch = 0;
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    if (data.stock) {
      let needsUpdate = false;
      let newStock = { ...data.stock };
      
      for (const [storeId, s] of Object.entries(newStock)) {
        if (s.reserved > 0 && (s.quantity === 0 || s.quantity < s.reserved)) {
           console.log(`Fixing ${data.name}: q=${s.quantity}, r=${s.reserved} -> setting r=0`);
           s.reserved = 0;
           needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, { stock: newStock });
        opsInBatch++;
        updatedCount++;
      }
    }
  });
  
  if (opsInBatch > 0) {
    await batch.commit();
  }
  
  console.log(`Finished! Updated ${updatedCount} products.`);
  process.exit(0);
}

fixStuckReserved().catch(console.error);
