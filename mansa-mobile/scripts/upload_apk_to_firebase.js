const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '..', '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'management-easy-order.firebasestorage.app'
});

const bucket = getStorage().bucket();
const db = getFirestore(app);

async function uploadApk() {
  const filePath = path.resolve(__dirname, '..', '..', 'public', 'mansa-mobile.apk');
  const destination = 'apps/mansa-mobile.apk';

  console.log(`Starting upload of ${filePath} to Firebase Storage: ${destination}...`);

  await bucket.upload(filePath, {
    destination: destination,
    metadata: {
      contentType: 'application/vnd.android.package-archive',
      cacheControl: 'public, max-age=31536000'
    }
  });

  console.log('Upload finished! Making file public...');
  const file = bucket.file(destination);
  
  try {
    await file.makePublic();
    console.log('File is now public!');
  } catch (err) {
    console.log('makePublic note:', err.message);
  }

  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media`;
  console.log('PUBLIC_FIREBASE_URL:', publicUrl);

  await db.collection('settings').doc('mobile_app').set({
    apkUrl: publicUrl,
    updatedAt: new Date().toISOString(),
    version: '1.0.0'
  }, { merge: true });

  console.log('Firestore settings/mobile_app updated successfully!');
}

uploadApk().catch(err => {
  console.error('Error during upload:', err);
  process.exit(1);
});
