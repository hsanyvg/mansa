const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyBdnfIwyrDt3BOv875HsofMASq6ftzZzls",
  projectId: "management-easy-order"
});
const db = getFirestore(app);

async function checkOrders() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  console.log("Today timestamp:", today, new Date(today).toISOString());

  const snap = await getDocs(collection(db, 'orders'));
  console.log("Total orders in DB:", snap.size);

  const todayOrders = [];
  snap.forEach(d => {
    const data = d.data();
    if (!data.date) return;
    const orderTime = data.date.toDate ? data.date.toDate().getTime() : new Date(data.date).getTime();
    if (orderTime >= today) {
      todayOrders.push({ id: d.id, ...data, orderTimeStr: new Date(orderTime).toISOString() });
    }
  });

  console.log(`\nFound ${todayOrders.length} orders for today:`);
  todayOrders.forEach(o => {
    console.log(`- Order ID: ${o.id}, Status: ${o.status}, Date: ${o.orderTimeStr}, Amount: ${o.totalAmount}`);
  });
  process.exit(0);
}

checkOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
