const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const serviceAccount = require('./serviceAccountKey.json');
if (!getApps().length) { initializeApp({ credential: cert(serviceAccount) }); }
const db = getFirestore();
async function check() {
  const collections = await db.collection('users').doc('tw2iY8uCDlz0EQzsu33g').listCollections();
  console.log('tw2...', collections.map(c => c.id));
  const c2 = await db.collection('users').doc('k2GzrY0lHEWBogC6HNvA').listCollections();
  console.log('k2...', c2.map(c => c.id));
}
check().then(() => process.exit(0)).catch(console.error);
