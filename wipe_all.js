const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function deleteCollection(collectionRef, batchSize) {
  const query = collectionRef.orderBy('__name__').limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function wipeAll() {
  try {
    let uid = 'unknown';
    try {
      const adminUserRecord = await getAuth().getUserByEmail('hsanyvg@gmail.com');
      uid = adminUserRecord.uid;
      console.log(`Found Admin UID: ${uid}`);
    } catch(e) {
      console.log("Could not fetch admin UID directly, attempting to search users...");
    }

    // Wipe employee_mappings and their Auth accounts
    const mappingsRef = db.collection('employee_mappings');
    const mappingsSnap = await mappingsRef.get();
    for(let d of mappingsSnap.docs) {
      try {
        await getAuth().deleteUser(d.id);
        console.log(`Deleted auth user ${d.id}`);
      } catch(e) {}
      await d.ref.delete();
    }
    console.log("Deleted employee mappings and associated Auth users.");

    const collectionsToWipe = [
      'orders', 'products', 'categories', 'employees', 'system_users',
      'facebook_pages', 'customers', 'treasury_transactions', 'treasury_summary',
      'cpo_invoices', 'cpo_payments', 'receipts', 'installments', 'notifications', 'chat_conversations',
      'settings'
    ];

    if (uid !== 'unknown') {
      for (let col of collectionsToWipe) {
        console.log(`Wiping users/${uid}/${col}...`);
        await deleteCollection(db.collection(`users/${uid}/${col}`), 500);
      }
    }

    // Also try to wipe if the user was just logged in with generic email
    const usersSnap = await db.collection('users').listDocuments(); // To get all root documents
    for (let uDoc of usersSnap) {
      const dUid = uDoc.id;
      for (let col of collectionsToWipe) {
        await deleteCollection(db.collection(`users/${dUid}/${col}`), 500);
      }
    }
    
    // Wipe stray root collections
    await deleteCollection(db.collection('orders'), 500);
    await deleteCollection(db.collection('products'), 500);

    console.log("WIPE COMPLETE.");
  } catch(e) {
    console.error("Wipe failed:", e);
  }
}

wipeAll();
