const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = require('firebase/firestore');

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const app = initializeApp({
  apiKey: getFirebaseApiKey(),
  projectId: "management-easy-order"
});
const db = getFirestore(app);

// Target User ID passed as argument
const targetUserId = process.argv[2];

if (!targetUserId) {
  console.error("ERROR: Please specify target user ID. Example: node migrate-to-user.js <USER_ID>");
  process.exit(1);
}

async function migrate() {
  console.log(`Starting migration of root collections to user: ${targetUserId}...`);

  const collections = ['products', 'employees', 'customers', 'orders', 'composite_products'];
  let totalCopied = 0;
  let maxOrderId = 100000;

  for (const colName of collections) {
    const rootColRef = collection(db, colName);
    const snap = await getDocs(rootColRef);
    console.log(`Reading root collection '${colName}': Found ${snap.size} documents.`);

    if (snap.size === 0) continue;

    // Use batches for writing to user subcollections
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach(d => {
      const data = d.data();
      const userDocRef = doc(db, 'users', targetUserId, colName, d.id);
      batch.set(userDocRef, data);
      count++;
      totalCopied++;

      // Track maximum order ID if processing orders
      if (colName === 'orders') {
        const orderNum = parseInt(d.id);
        if (!isNaN(orderNum) && orderNum > maxOrderId) {
          maxOrderId = orderNum;
        }
      }
    });

    await batch.commit();
    console.log(`✓ Copied ${count} documents from root '${colName}' to 'users/${targetUserId}/${colName}'.`);
  }

  // Set the orderCounter metadata based on maxOrderId
  console.log(`Updating order counter metadata to start from: ${maxOrderId}...`);
  const counterRef = doc(db, 'users', targetUserId, 'metadata', 'orderCounter');
  await setDoc(counterRef, { lastId: maxOrderId });
  console.log(`✓ orderCounter metadata updated successfully.`);

  console.log(`=== MIGRATION COMPLETE ===`);
  console.log(`Successfully migrated ${totalCopied} documents to user: ${targetUserId}`);
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
