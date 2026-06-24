const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const usersRef = await db.collection('users').get();
  for (const doc of usersRef.docs) {
    const ordersRef = await db.collection('users').doc(doc.id).collection('orders').where('status', '==', 'delivered').get();
    
    let sysTotal = 0;
    let missingDeliveryCostOrders = [];
    let net27kOrders = [];

    ordersRef.docs.forEach(o => {
      const data = o.data();
      const gross = data.totalAmount || data.price || 0;
      const delivery = data.deliveryCost || 0;
      const net = gross - delivery;
      
      sysTotal += net;

      if (net === 27000) net27kOrders.push(data.orderNumber || o.id);
      if (delivery === 0 && gross > 0) missingDeliveryCostOrders.push({ id: o.id, gross });
    });

    if (sysTotal > 0) {
      console.log('--- User:', doc.id, '---');
      console.log('System Treasury Total:', sysTotal);
      if (net27kOrders.length > 0) console.log('Orders with exactly 27,000 net:', net27kOrders);
      
      const missingDeliveryCostTotal = missingDeliveryCostOrders.reduce((sum, o) => sum + o.gross, 0);
      if (missingDeliveryCostOrders.length > 0) {
        console.log(`Found ${missingDeliveryCostOrders.length} delivered orders with NO deliveryCost. Gross total of these: ${missingDeliveryCostTotal}`);
      }
    }
  }
}

check().then(() => process.exit(0)).catch(console.error);
