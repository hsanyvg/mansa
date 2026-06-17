const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc } = require("firebase/firestore");

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
  const storesSnap = await getDocs(collection(db, 'users', adminUid, 'stores'));
  const firstStore = storesSnap.docs[0]?.id;
  if (!firstStore) return console.log("No store found");

  const snap = await getDocs(collection(db, 'users', adminUid, 'products'));
  let count = 0;
  for (const pDoc of snap.docs) {
    const data = pDoc.data();
    if (data.stock && data.stock['default_store']) {
      const stock = { ...data.stock };
      const defaultData = stock['default_store'];
      delete stock['default_store'];
      
      if (!stock[firstStore]) {
        stock[firstStore] = defaultData;
      } else {
        stock[firstStore].quantity = (stock[firstStore].quantity || 0) + (defaultData.quantity || 0);
        stock[firstStore].reserved = (stock[firstStore].reserved || 0) + (defaultData.reserved || 0);
      }
      
      await updateDoc(doc(db, 'users', adminUid, 'products', pDoc.id), { stock });
      count++;
    }
  }
  console.log(`Migrated ${count} products to use store ${firstStore} instead of default_store`);
}
go().then(()=>process.exit(0)).catch(console.error);
