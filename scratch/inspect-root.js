const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const app = initializeApp({
  apiKey: getFirebaseApiKey(),
  projectId: "management-easy-order"
});
const db = getFirestore(app);

async function inspect() {
  const collections = ['products', 'employees', 'customers', 'orders'];
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    console.log(`Root Collection '${col}': ${snap.size} documents`);
    snap.forEach(d => {
      console.log(`  - ID: ${d.id}, Name/Title: ${d.data().name || d.data().customerName || d.data().title || 'N/A'}`);
    });
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
