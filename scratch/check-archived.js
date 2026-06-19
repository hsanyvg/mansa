const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const firebaseConfig = {
  apiKey: getFirebaseApiKey(),
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function go() {
  const adminUid = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  for (const id of ['100114', '100132']) {
     const docSnap = await getDoc(doc(db, 'users', adminUid, 'orders', id));
     console.log(`Order ${id}:`);
     if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`- Status: ${data.status}`);
        console.log(`- isArchived: ${data.isArchived}`);
     } else {
        console.log("- Not found");
     }
  }
}

go().then(()=>process.exit(0)).catch(console.error);
