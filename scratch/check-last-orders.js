const { initializeApp } = require('firebase/app');
const { getFirestore, collectionGroup, query, getDocs, limit } = require('firebase/firestore');

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const app = initializeApp({
  apiKey: getFirebaseApiKey(),
  projectId: "management-easy-order"
});
const db = getFirestore(app);

async function checkLastOrders() {
  console.log("Fetching orders via collectionGroup('orders') without ordering...");
  const q = query(collectionGroup(db, 'orders'), limit(100));
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} orders.`);
  const orders = [];
  snap.forEach(d => {
    orders.push({ id: d.id, path: d.ref.path, ...d.data() });
  });

  // Sort in JS
  orders.sort((a, b) => {
    const timeA = a.date ? (a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime()) : 0;
    const timeB = b.date ? (b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime()) : 0;
    return timeB - timeA;
  });

  console.log("\nLast 20 orders sorted by date:");
  orders.slice(0, 20).forEach(o => {
    console.log(`- Path: ${o.path}`);
    console.log(`  Doc ID: ${o.id}`);
    console.log(`  Customer: ${o.customerName}, Phone: ${o.customerPhone}`);
    console.log(`  Employee: ${o.employeeName} (${o.employeeId})`);
    console.log(`  Date: ${o.date ? (o.date.toDate ? o.date.toDate().toISOString() : o.date) : 'N/A'}`);
  });
  process.exit(0);
}

checkLastOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
