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
const auth = getAuth();

async function fixPendingOrders() {
  console.log("Starting to fix pending orders...");
  let totalFixed = 0;
  
  try {
    const listUsersResult = await auth.listUsers(1000);
    const uids = listUsersResult.users.map(u => u.uid);
    uids.push('anonymous');
    
    for (const userId of uids) {
      const ordersSnapshot = await db.collection(`users/${userId}/orders`).where('status', '==', 'pending').get();
      
      let batch = db.batch();
      let batchCount = 0;
      let userFixedCount = 0;
      
      for (const orderDoc of ordersSnapshot.docs) {
        const orderData = orderDoc.data();
        let updateData = {};
        let needsUpdate = false;
        
        if (orderData.deliveryCost > 0) {
          const currentTotal = orderData.totalAmount || orderData.price || 0;
          updateData.totalAmount = currentTotal + orderData.deliveryCost;
          updateData.deliveryCost = 0;
          needsUpdate = true;
        }
        
        if (orderData.shippingCompany || orderData.shipmentCompany || orderData.jenniShipmentId || orderData.deliveryCompany) {
          updateData.shippingCompany = '';
          updateData.shipmentCompany = '';
          updateData.jenniShipmentId = '';
          updateData.deliveryCompany = '';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          batch.update(orderDoc.ref, updateData);
          batchCount++;
          userFixedCount++;
          totalFixed++;
          
          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      if (userFixedCount > 0) {
        console.log(`Fixed ${userFixedCount} orders for user ${userId}`);
      }
    }
    
    console.log(`Finished fixing pending orders. Total orders fixed: ${totalFixed}`);
  } catch (err) {
    console.error("Error fixing orders:", err);
  }
}

fixPendingOrders();
