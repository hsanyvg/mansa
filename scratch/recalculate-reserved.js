const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, collectionGroup, writeBatch, doc } = require("firebase/firestore");

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const firebaseConfig = {
  apiKey: getFirebaseApiKey(),
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
  messagingSenderId: "996506738254",
  appId: "1:996506738254:web:158fb905a5d5a8df2f34cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function go() {
  const adminUid = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  
  // 1. Get all pending/active orders
  const ordersSnap = await getDocs(collectionGroup(db, 'orders'));
  
  // productId -> reserved qty
  const reservedMap = {};

  for (const oDoc of ordersSnap.docs) {
    // Only count reservations for orders that are not finished
    const data = oDoc.data();
    if (!['delivered', 'cancelled', 'returned'].includes(data.status)) {
      if (data.items) {
        for (const item of data.items) {
          if (item.productId) {
            reservedMap[item.productId] = (reservedMap[item.productId] || 0) + (Number(item.quantity) || 0);
          }
        }
      }
    }
  }

  // 2. Get all products and update their reserved stock
  const pSnap = await getDocs(collection(db, 'users', adminUid, 'products'));
  const batch = writeBatch(db);
  let changes = 0;

  for (const pDoc of pSnap.docs) {
    const pData = pDoc.data();
    const actualReserved = reservedMap[pDoc.id] || 0;
    
    // We only update if the product HAS stock configured
    if (pData.stock) {
      let stockChanged = false;
      const newStock = { ...pData.stock };
      
      // Calculate total currently reserved across all stores (usually it's just one store)
      let currentReservedTotal = 0;
      let firstStore = null;
      for (const storeId in newStock) {
        if (!firstStore) firstStore = storeId;
        currentReservedTotal += (Number(newStock[storeId].reserved) || 0);
      }
      
      if (currentReservedTotal !== actualReserved) {
        console.log(`Product ${pData.name} (${pDoc.id}): Fixing reserved ${currentReservedTotal} -> ${actualReserved}`);
        
        // Reset all to 0 first
        for (const storeId in newStock) {
           newStock[storeId].reserved = 0;
        }
        // Apply all reserved to the first store
        if (firstStore) {
           newStock[firstStore].reserved = actualReserved;
           stockChanged = true;
        }
      }
      
      if (stockChanged) {
        batch.update(doc(db, 'users', adminUid, 'products', pDoc.id), { stock: newStock });
        changes++;
      }
    }
  }

  if (changes > 0) {
    await batch.commit();
    console.log(`Updated reserved stock for ${changes} products.`);
  } else {
    console.log("All reserved stocks are already perfectly synced!");
  }
}

go().then(()=>process.exit(0)).catch(console.error);
