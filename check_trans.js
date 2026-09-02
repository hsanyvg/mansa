const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "dummy",
  authDomain: "inventory-system-a1851.firebaseapp.com",
  projectId: "inventory-system-a1851",
  storageBucket: "inventory-system-a1851.appspot.com",
  messagingSenderId: "dummy",
  appId: "dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const q = query(collection(db, 'users', '5aI6n827y6TjZ86V9hG1l8bK8P33', 'treasury_transactions'), where('externalStatementId', '==', '284152'));
  const snap = await getDocs(q);
  console.log("Found transactions:", snap.size);
  if (snap.size > 0) {
    console.log(snap.docs[0].data());
  }
}
main().catch(console.error);
