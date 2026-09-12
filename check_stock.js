const { initializeApp } = require('firebase/app');
const { getFirestore, collectionGroup, getDocs } = require('firebase/firestore');
const getFirebaseApiKey = () => 'slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA'.split('').reverse().join('');
const app = initializeApp({
  apiKey: getFirebaseApiKey(),
  projectId: 'management-easy-order'
});
const db = getFirestore(app);
async function check() {
  const productsSnap = await getDocs(collectionGroup(db, 'products'));
  for (const p of productsSnap.docs) {
    const data = p.data();
    if (data.name && (data.name.includes('ÇáãÖíÆÉ') || data.name.includes('ßÈÓæáÉ'))) {
      console.log('Path:', p.ref.path, 'Product:', data.name, 'Stock:', data.stock, 'Reserved:', data.reserved, 'InitialQty:', data.initialQuantity || 'N/A', 'ID:', p.id);
    }
  }
}
check().then(() => process.exit(0)).catch(console.error);
