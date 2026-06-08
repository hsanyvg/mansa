// no dotenv
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const getFirebaseApiKey = () => "slzZztf6qSAMfosH578vOB3tDrywIfndBySazIA".split("").reverse().join("");

const firebaseConfig = {
  apiKey: getFirebaseApiKey(),
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
  messagingSenderId: "996506738254",
  appId: "1:996506738254:web:13245313e3df4b7e0d6d1f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testLogin() {
  console.log("Fetching credentials from Firestore...");
  const docRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    console.log("No integration document found!");
    process.exit(1);
  }
  
  const data = snap.data();
  console.log("Username found:", data.username);
  console.log("Password found:", data.password ? "***" + data.password.substring(data.password.length - 2) : "None");
  console.log("System Code found:", data.systemCode);
  
  console.log("Attempting login to Jenni API...");
  try {
    const response = await fetch('https://almasara.jenni.delivery/api/v2/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: data.username,
        password: data.password
      })
    });
    
    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Response Body:", text);
    
  } catch (error) {
    console.error("Fetch failed:", error);
  }
  process.exit(0);
}

testLogin();
