const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

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
  const pRef = doc(db, 'users', 'guAXkcygceeBkpwtFdf1n8O3dRX2', 'products', '25KnWl4Crv1bS2HYLek8');
  const snap = await getDoc(pRef);
  console.log(JSON.stringify(snap.data(), null, 2));
}
go().then(()=>process.exit(0)).catch(console.error);
