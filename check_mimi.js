const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkOrders() {
  const usersSnap = await db.collection('users').get();
  
  for (const userDoc of usersSnap.docs) {
    const ordersRef = userDoc.ref.collection('orders');
    const ordersSnap = await ordersRef.where('employeeName', '==', 'ميمي').get();
    
    if (!ordersSnap.empty) {
      console.log(`User ${userDoc.id} has ${ordersSnap.size} orders with employeeName 'ميمي'`);
      ordersSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Order ID: ${data.id}, employeeId: ${data.employeeId}, bookingEmployeeName: ${data.bookingEmployeeName}`);
      });
      break;
    }
  }
}

checkOrders();
