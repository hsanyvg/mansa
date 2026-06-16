const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function cleanProducts() {
  try {
    const storesSnap = await db.collectionGroup('stores').get();
    const validStoreIds = new Set(storesSnap.docs.map(d => d.id));
    console.log(`Found ${validStoreIds.size} valid stores.`);

    const productsSnap = await db.collectionGroup('products').get();
    let updatedCount = 0;

    for (let doc of productsSnap.docs) {
      const data = doc.data();
      if (!data.stock) continue;

      let hasGhost = false;
      let newStock = { ...data.stock };
      
      for (let storeId in newStock) {
        if (!validStoreIds.has(storeId)) {
          console.log(`Removing ghost store ${storeId} from product ${doc.id}`);
          delete newStock[storeId];
          hasGhost = true;
        }
      }

      if (hasGhost) {
        let totalBaseQuantity = 0;
        let mappedUnitsForUtils = data.units ? data.units.map((u) => ({
            name: u.type,
            multiplier: Number(u.count) || 1
        })) : [];

        Object.values(newStock).forEach((s) => {
            const qty = Number(s.quantity) || 0;
            const matchedUnit = mappedUnitsForUtils.find(u => u.name === s.unit);
            const multiplier = matchedUnit ? matchedUnit.multiplier : 1;
            totalBaseQuantity += (qty * multiplier);
        });

        await doc.ref.update({
          stock: newStock,
          totalBaseQuantity: totalBaseQuantity
        });
        updatedCount++;
      }
    }

    console.log(`Cleaned up ${updatedCount} products.`);
  } catch (e) {
    console.error(e);
  }
}

cleanProducts();
