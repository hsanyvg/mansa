const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const firebaseConfig = {
  apiKey: getFirebaseApiKey(),
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
  messagingSenderId: "996506738254",
  appId: "1:996506738254:web:158fb905a5d5a8df2f34cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateApkUrl() {
  const newUrl = "https://expo.dev/artifacts/eas/7KwmvIcpf-GSAmgGW__uKZcR99uhwWqZAuTFmiX2_r0.apk";
  await setDoc(doc(db, "settings", "mobile_app"), { apkUrl: newUrl }, { merge: true });
  console.log("Updated apkUrl to:", newUrl);
}

updateApkUrl().then(() => process.exit(0)).catch(console.error);
