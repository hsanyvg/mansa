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
  const adminUid = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersSnap = await getDocs(collectionGroup(db, 'orders'));
  
  const toDelete = [];
  
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    const idNum = Number(doc.id);
    if (!isNaN(idNum) && idNum < 100105) {
      toDelete.push({
        id: doc.id,
        customerName: data.customerName,
        status: data.status,
        path: doc.ref.path
      });
    }
  }
  
  console.log(`Found ${toDelete.length} orders before 100105.`);
  console.table(toDelete);
}

go().then(()=>process.exit(0)).catch(console.error);
