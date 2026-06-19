const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

async function findAndDeleteTestOrders() {
  const listUsersResult = await auth.listUsers(1000);
  const users = listUsersResult.users;
  console.log(`Found ${users.length} users in Auth.`);
  
  let totalDeleted = 0;
  
  for (const userRecord of users) {
    const userId = userRecord.uid;
    const ordersRef = db.collection('users').doc(userId).collection('orders');
    const snap = await ordersRef.get();
    
    let userDeleted = 0;
    let batch = db.batch();
    
    snap.forEach(doc => {
      const data = doc.data();
      if (data.isTest || (data.orderNumber && data.orderNumber.startsWith('TEST-'))) {
        batch.delete(doc.ref);
        userDeleted++;
        totalDeleted++;
      }
    });
    
    if (userDeleted > 0) {
      await batch.commit();
      console.log(`Deleted ${userDeleted} test orders for user: ${userId} (${userRecord.email || 'No email'})`);
    }
  }
  
  console.log(`Total deleted across all users: ${totalDeleted}`);
}

findAndDeleteTestOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
