const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!getAuth().app) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

async function checkUser() {
  try {
    const user = await getAuth().getUserByEmail('07703605178@mansa.app');
    console.log("User found in Auth:", user.uid, user.email);
  } catch (err) {
    console.error("User not found in Auth:", err.message);
  }
}

checkUser();
