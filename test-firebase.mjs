import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdnfIwyrDt3BOv875HsofMASq6ftzZzls",
  authDomain: "management-easy-order.firebaseapp.com",
  projectId: "management-easy-order",
  storageBucket: "management-easy-order.firebasestorage.app",
  messagingSenderId: "996506738254",
  appId: "1:996506738254:web:13245313e3df4b7e0d6d1f",
  measurementId: "G-3LD00EG021"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    console.log("Testing read...");
    const snap = await getDocs(collection(db, 'categories'));
    console.log("Read success, docs:", snap.docs.length);

    console.log("Testing write...");
    const docRef = await addDoc(collection(db, 'categories'), { test: "data" });
    console.log("Write success, id:", docRef.id);
  } catch (e) {
    console.error("FIREBASE ERROR:", e.message);
  }
}

test();
