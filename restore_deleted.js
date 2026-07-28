const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:\\Users\\Hasan\\.gemini\\antigravity\\scratch\\inventory-system\\serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function restoreDeletedOrders() {
  const ordersSnapshot = await db.collectionGroup('orders').where('isDeleted', '==', true).get();
  
  if (!ordersSnapshot.empty) {
    console.log(`Found ${ordersSnapshot.docs.length} deleted orders in total`);
      
      const batch = db.batch();
      let restoredCount = 0;
      
      ordersSnapshot.docs.forEach(doc => {
        const d = doc.data();
        console.log(`Restoring Order ${doc.id}: ${d.customerName} - ${new Date(d.timestamp || Date.now()).toLocaleString()}`);
        
        batch.update(doc.ref, {
          isDeleted: FieldValue.delete()
        });
        restoredCount++;
      });
      
      if (restoredCount > 0) {
        await batch.commit();
        console.log(`Successfully restored ${restoredCount} orders.`);
      }
      
  } else {
      console.log(`No deleted orders found`);
  }
}

restoreDeletedOrders().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
