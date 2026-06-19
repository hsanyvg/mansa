const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where, collectionGroup } = require("firebase/firestore");

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
  
  // Get the product ID
  const pSnap = await getDocs(query(collection(db, 'users', adminUid, 'products'), where('name', '==', 'قاصة التحدي15مليون')));
  if (pSnap.empty) return console.log("Product not found");
  const productId = pSnap.docs[0].id;
  console.log(`Product ID: ${productId}`);

  // Get all orders and filter locally
  const ordersSnap = await getDocs(collectionGroup(db, 'orders'));
  
  let totalReserved = 0;
  const ordersFound = [];

  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    // Only pending orders keep stock reserved!
    // But let's check all statuses just in case
    
    if (!data.items) continue;
    
    for (const item of data.items) {
      if (item.productId === productId || item.productName === 'قاصة التحدي15مليون') {
        ordersFound.push({
          id: doc.id,
          status: data.status,
          quantity: item.quantity,
          customerName: data.customerName,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : 'unknown'
        });
        
        // If status is not completed/rejected, it might be reserved
        if (['pending', 'processing', 'shipped', 'postponed'].includes(data.status || 'pending')) {
          totalReserved += item.quantity || 0;
        }
      }
    }
  }
  
  console.log("\nOrders containing this product:");
  console.table(ordersFound);
  console.log(`\nCalculated total reserved from pending/active orders: ${totalReserved}`);
  
  // Check the product document itself
  const pData = pSnap.docs[0].data();
  console.log("\nProduct stock data:", JSON.stringify(pData.stock, null, 2));
}

go().then(()=>process.exit(0)).catch(console.error);
