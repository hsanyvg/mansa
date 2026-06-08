const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const https = require("https");
const fs = require("fs");
const path = require("path");

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
const storage = getStorage(app);

const apkSourceUrl = "https://expo.dev/artifacts/eas/jo4nXUM65oW1JE2qCXjTU8.apk";
const tempFilePath = path.join(__dirname, "temp-app.apk");

// Helper function to download file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      // Handle all HTTP redirect codes (300-399)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  try {
    console.log("1. Downloading APK from Expo servers...");
    await downloadFile(apkSourceUrl, tempFilePath);
    console.log("✓ Download complete. File saved temporarily.");

    console.log("2. Reading file buffer...");
    const fileBuffer = fs.readFileSync(tempFilePath);
    console.log(`✓ Read success. Size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    console.log("3. Uploading APK to Firebase Storage...");
    const storageRef = ref(storage, "apps/mansa-mobile.apk");
    const uploadResult = await uploadBytes(storageRef, fileBuffer, {
      contentType: "application/vnd.android.package-archive"
    });
    console.log("✓ Upload to Firebase Storage complete.");

    console.log("4. Retrieving public download URL...");
    const publicUrl = await getDownloadURL(uploadResult.ref);
    console.log(`✓ Public URL: ${publicUrl}`);

    console.log("5. Updating Firestore configuration...");
    const docRef = doc(db, 'settings', 'mobile_app');
    await setDoc(docRef, {
      apkUrl: publicUrl,
      updatedAt: new Date()
    }, { merge: true });
    console.log("✓ Firestore config updated successfully.");

    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    console.log("✓ Temporary file cleaned up.");
    console.log("=== SUCCESS ===");
    process.exit(0);
  } catch (err) {
    console.error("ERROR during execution:", err);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    process.exit(1);
  }
}

run();
