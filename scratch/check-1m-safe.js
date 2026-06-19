const { initializeApp } = require("firebase/app");
const { getFirestore, collectionGroup, getDocs } = require("firebase/firestore");

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
  const productId = 'XTqJ6MLA6mZbd1ek8l92'; // قاصة التحدي مليون
  const ordersSnap = await getDocs(collectionGroup(db, 'orders'));
  
  const found = [];
  let sum = 0;
  
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    if (data.items) {
      for (const item of data.items) {
        // sometimes name has spaces, check both ID and Name
        if (item.productId === productId || item.productName.includes('قاصة التحدي مليون') || item.productName.includes('قاصة التحدي  مليون')) {
          // only pending/processing
          if (!['delivered', 'cancelled', 'returned'].includes(data.status)) {
             found.push({
               orderId: doc.id,
               status: data.status,
               customer: data.customerName,
               quantity: item.quantity,
               productNameInOrder: item.productName
             });
             sum += (Number(item.quantity) || 0);
          }
        }
      }
    }
  }
  
  console.log(`Found ${found.length} active orders containing this product. Total reserved: ${sum}`);
  console.table(found);
}

go().then(()=>process.exit(0)).catch(console.error);
