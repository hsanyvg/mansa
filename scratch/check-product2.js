const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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
  const snap = await getDocs(collection(db, 'users', '1X9B5r32D4W3n1gNnIfw3dG7Oa03', 'products'));
  const found = snap.docs.map(d=>({id: d.id, ...d.data()})).filter(p => p.name && p.name.includes('راية'));
  console.log(JSON.stringify(found, null, 2));
}
go().then(()=>process.exit(0)).catch(console.error);
