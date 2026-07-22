import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

function initFirebaseAdmin() {
  if (!getApps().length) {
    try {
      let serviceAccount;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } else {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      }
      
      initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error('Firebase admin initialization error', error);
    }
  }
}

initFirebaseAdmin();

const adminDb = getApps().length ? getFirestore() : null;

// Proxy for adminAuth so require('firebase-admin/auth') is only executed on demand when adminAuth is accessed
const adminAuth = new Proxy({}, {
  get(target, prop) {
    try {
      const { getAuth } = require('firebase-admin/auth');
      const authInstance = getApps().length ? getAuth() : null;
      if (!authInstance) return undefined;
      const val = (authInstance as any)[prop];
      if (typeof val === 'function') {
        return val.bind(authInstance);
      }
      return val;
    } catch (err) {
      console.error('Error loading adminAuth:', err);
      return undefined;
    }
  }
}) as any;

export { adminDb, adminAuth };
