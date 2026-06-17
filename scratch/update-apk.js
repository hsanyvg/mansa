const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateApkUrl() {
  const newUrl = "https://expo.dev/artifacts/eas/7KwmvIcpf-GSAmgGW__uKZcR99uhwWqZAuTFmiX2_r0.apk";
  await db.collection('settings').doc('mobile_app').set({ apkUrl: newUrl }, { merge: true });
  console.log("Updated apkUrl to:", newUrl);
}

updateApkUrl().then(() => process.exit(0)).catch(console.error);
