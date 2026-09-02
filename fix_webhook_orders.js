const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixWebhookOrders() {
  try {
    const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
    const ordersRef = db.collection('users').doc(userId).collection('orders');
    
    const ordersSnap = await ordersRef.get();
    
    let updatedCount = 0;
    const batch = db.batch();
    
    ordersSnap.forEach(doc => {
      const data = doc.data();
      if (data.employeeId === 'landing_page_webhook' && data.employeeName !== 'رابط خارجي') {
        const actualBookingName = data.employeeName; // holds 'ميمي'
        batch.update(doc.ref, {
          employeeName: 'رابط خارجي',
          bookingEmployeeName: actualBookingName
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updatedCount} old webhook orders.`);
    } else {
      console.log('No old webhook orders needed updating.');
    }
  } catch (error) {
    console.error('Error updating orders:', error);
  }
}

fixWebhookOrders();
