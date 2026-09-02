const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkRecentOrders() {
  const usersSnap = await db.collection('users').get();
  
  for (const userDoc of usersSnap.docs) {
    const ordersRef = userDoc.ref.collection('orders');
    // Just get the last 50 orders
    const ordersSnap = await ordersRef.orderBy('addDate', 'desc').limit(20).get();
    
    if (!ordersSnap.empty) {
      console.log(`--- User ${userDoc.id} ---`);
      ordersSnap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${data.id}, empName: '${data.employeeName}', bookingEmp: '${data.bookingEmployeeName}', empId: '${data.employeeId}'`);
      });
      break;
    }
  }
}

checkRecentOrders();
