const { initializeApp } = require("firebase/app");
const { getFirestore, collectionGroup, getDocs, limit, query } = require("firebase/firestore");

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
  const snap = await getDocs(query(collectionGroup(db, 'orders'), limit(5)));
  snap.forEach(d => {
    console.log(d.ref.path);
    console.log(d.data().items);
  });
}
go().then(()=>process.exit(0)).catch(console.error);
