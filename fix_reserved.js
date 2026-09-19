const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const getStockState = (status) => {
  if (['shipped', 'delivered', 'partial', 'returned_agent', 'returned'].includes(status)) return 'HARD_DEDUCTED';
  if (['cancelled', 'returned_warehouse'].includes(status)) return 'FREE';
  return 'SOFT_ALLOCATED';
};

async function run() {
  console.log('Starting reserved stock fix...');
  try {
    // Find all UIDs by looking at collection group
    const productsDocs = await db.collectionGroup('products').get();
    const uids = new Set();
    productsDocs.docs.forEach(doc => {
      // doc.ref.path is like users/{uid}/products/{productId}
      const parts = doc.ref.path.split('/');
      if (parts.length >= 4 && parts[0] === 'users' && parts[2] === 'products') {
        uids.add(parts[1]);
      }
    });

    console.log(`Found ${uids.size} users with products.`);

    for (const uid of uids) {
      console.log(`Processing user: ${uid}`);
      
      const ordersSnap = await db.collection('users').doc(uid).collection('orders').get();
      const productsSnap = await db.collection('users').doc(uid).collection('products').get();
      
      // Calculate reserved amounts from active orders
      const reservedMap = {}; // { productId: reservedQuantity }
      
      for (const orderDoc of ordersSnap.docs) {
        const order = orderDoc.data();
        if (order.isDeleted) continue;
        
        const state = getStockState(order.status);
        if (state === 'SOFT_ALLOCATED') {
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              if (item.isComposite && item.composition) {
                for (const comp of item.composition) {
                  const qty = comp.quantityNeeded * item.quantity;
                  reservedMap[comp.itemId] = (reservedMap[comp.itemId] || 0) + qty;
                }
              } else if (item.productId) {
                reservedMap[item.productId] = (reservedMap[item.productId] || 0) + item.quantity;
              }
            }
          }
        }
      }
      
      // Update all products
      const batch = db.batch();
      let count = 0;
      let userUpdates = 0;
      
      for (const productDoc of productsSnap.docs) {
        const product = productDoc.data();
        const expectedReserved = reservedMap[productDoc.id] || 0;
        
        let needsUpdate = false;
        let stock = product.stock || {};
        
        // Check current reserved
        let totalCurrentReserved = 0;
        let stores = Object.keys(stock);
        
        for (const storeId of stores) {
          totalCurrentReserved += (stock[storeId].reserved || 0);
        }
        
        if (totalCurrentReserved !== expectedReserved) {
          // Zero out all reserved
          for (const storeId of stores) {
            stock[storeId].reserved = 0;
          }
          
          // Put the expected reserved in the first store
          const firstStoreKey = stores[0] || 'default_store';
          if (!stock[firstStoreKey]) {
            stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: product.units?.[0]?.type || 'قطعة' };
          }
          stock[firstStoreKey].reserved = expectedReserved;
          
          batch.update(productDoc.ref, { stock });
          needsUpdate = true;
          userUpdates++;
          console.log(`- Product ${productDoc.id} (${product.name}): Fixed reserved from ${totalCurrentReserved} to ${expectedReserved}`);
        }
        
        if (needsUpdate) {
          count++;
          if (count >= 400) { // Batch limit is 500
            await batch.commit();
            count = 0;
          }
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      console.log(`Finished processing user: ${uid}. Updated ${userUpdates} products.`);
    }
    
    console.log('Successfully completed reserved stock fix!');
  } catch (error) {
    console.error('Error fixing reserved stock:', error);
  }
}

run();
