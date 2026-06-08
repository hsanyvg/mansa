const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const firebaseConfig = {
  apiKey: getFirebaseApiKey(),
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
  messagingSenderId: "996506738254",
  appId: "1:996506738254:web:13245313e3df4b7e0d6d1f",
  measurementId: "G-3LD00EG021"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const docRef = doc(db, 'settings', 'mobile_app');
    await setDoc(docRef, {
      apkUrl: "https://expo.dev/artifacts/eas/jo4nXUM65oW1JE2qCXjTU8.apk",
      updatedAt: new Date()
    }, { merge: true });
    console.log("SUCCESS: Firestore updated with direct APK download URL.");
    process.exit(0);
  } catch (err) {
    console.error("ERROR updating Firestore:", err);
    process.exit(1);
  }
}

run();
