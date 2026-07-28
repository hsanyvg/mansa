const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:\\Users\\Hasan\\.gemini\\antigravity\\scratch\\inventory-system\\serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findDeletedOrders() {
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    const ordersSnapshot = await db.collection('users').doc(userDoc.id).collection('orders')
      .where('isDeleted', '==', true)
      .get();
      
    if (!ordersSnapshot.empty) {
      console.log(`Found ${ordersSnapshot.docs.length} deleted orders for user ${userDoc.id}`);
      ordersSnapshot.docs.forEach(doc => {
        const d = doc.data();
        console.log(`- Order ${doc.id}: ${d.customerName} - ${new Date(d.timestamp || Date.now()).toLocaleString()}`);
      });
    }
  }
}

findDeletedOrders().catch(console.error);
