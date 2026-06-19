const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function applyStockTransition(stock, oldState, newState, qty, defaultUnit) {
  const changeReserved = (amount) => {
    const firstStoreKey = Object.keys(stock)[0] || 'default_store';
    if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
    stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + amount;
  };

  const changeQuantity = (amount) => {
    if (amount > 0) {
      const firstStoreKey = Object.keys(stock)[0] || 'default_store';
      if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
      stock[firstStoreKey].quantity += amount;
    } else {
      let remaining = Math.abs(amount);
      for (const storeId in stock) {
        if (remaining <= 0) break;
        if (stock[storeId].quantity > 0) {
          const deduct = Math.min(stock[storeId].quantity, remaining);
          stock[storeId].quantity -= deduct;
          remaining -= deduct;
        }
      }
      if (remaining > 0) {
        const firstStoreKey = Object.keys(stock)[0] || 'default_store';
        if (!stock[firstStoreKey]) stock[firstStoreKey] = { quantity: 0, reserved: 0, unit: defaultUnit };
        stock[firstStoreKey].quantity -= remaining;
      }
    }
  };

  if (oldState === 'HARD_DEDUCTED' && newState === 'SOFT_ALLOCATED') {
    changeQuantity(qty);
    changeReserved(qty);
  }
}

async function revertOrders() {
  const userId = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
  const ordersRef = db.collection('users').doc(userId).collection('orders');
  
  // Get start of today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const snap = await ordersRef.where('status', '==', 'shipped').get();
  
  const recentOrders = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.shipmentCompany === 'المسرة' || data.shipmentCompany === 'Jenni Logistics') {
      const date = data.updatedAt ? data.updatedAt.toDate() : new Date(0);
      if (date >= todayStart) {
        recentOrders.push({ id: doc.id, ...data });
      }
    }
  });

  console.log(`Found ${recentOrders.length} orders to revert.`);
  if (recentOrders.length === 0) return;

  let revertedCount = 0;
  for (const orderData of recentOrders) {
    const batch = db.batch();
    const orderRef = ordersRef.doc(orderData.id);
    
    batch.update(orderRef, {
      status: 'pending',
      shipmentCompany: null,
      jenniShipmentId: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    const items = orderData.items || [];
    for (const item of items) {
      if (item.isComposite && item.composition) {
        for (const comp of item.composition) {
          const rawProdRef = db.collection('users').doc(userId).collection('products').doc(comp.itemId);
          const rawSnap = await rawProdRef.get();
          if (rawSnap.exists) {
            const rawData = rawSnap.data();
            let stock = { ...(rawData.stock || {}) };
            let qty = (comp.quantityNeeded || 1) * (item.quantity || 1);
            
            applyStockTransition(stock, 'HARD_DEDUCTED', 'SOFT_ALLOCATED', qty, rawData.units?.[0]?.type || 'قطعة');
            
            let newTotalBaseQuantity = 0;
            Object.values(stock).forEach(s => {
              const uMul = rawData.units?.find(u => u.type === s.unit)?.count || 1;
              newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
            });
            batch.update(rawProdRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
          }
        }
      } else {
        if (!item.productId) continue;
        const prodRef = db.collection('users').doc(userId).collection('products').doc(item.productId);
        const prodSnap = await prodRef.get();
        if (prodSnap.exists) {
          const prodData = prodSnap.data();
          let stock = { ...(prodData.stock || {}) };
          let qty = item.quantity || 1;

          applyStockTransition(stock, 'HARD_DEDUCTED', 'SOFT_ALLOCATED', qty, prodData.units?.[0]?.type || 'قطعة');

          let newTotalBaseQuantity = 0;
          Object.values(stock).forEach(s => {
            const uMul = prodData.units?.find(u => u.type === s.unit)?.count || 1;
            newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
          });
          batch.update(prodRef, { stock, totalBaseQuantity: newTotalBaseQuantity });
        }
      }
    }

    await batch.commit();
    revertedCount++;
  }

  console.log(`Successfully reverted ${revertedCount} orders.`);
}

revertOrders().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
