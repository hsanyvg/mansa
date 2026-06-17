const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

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
  const q = query(collection(db, 'users', '1X9B5r32D4W3n1gNnIfw3dG7Oa03', 'products'), where('name', '==', 'راية الامام العباس'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}
go().then(()=>process.exit(0)).catch(console.error);
