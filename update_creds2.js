const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyBdnfIwyrDt3BOv875HsofMASq6ftzZzls",
  projectId: "management-easy-order"
});
const db = getFirestore(app);

const docRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
setDoc(docRef, {
  username: '07768789880',
  password: '11223344',
  systemCode: 'TAJER_PRO_2026',
  updatedAt: new Date()
}, { merge: true })
.then(() => {
  console.log("Credentials updated successfully back to 07768789880!");
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
