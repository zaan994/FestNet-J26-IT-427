import * as admin from 'firebase-admin';

let isFirebaseInitialized = false;
let db: admin.firestore.Firestore | null = null;

try {
  // Check if Firebase service account or emulator is present
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp();
    db = admin.firestore();
    isFirebaseInitialized = true;
    console.log('[Firebase] Initialized Cloud Firestore successfully.');
  } else {
    console.log('[Firebase] Running in local/offline mode (in-memory data store active).');
  }
} catch (err) {
  console.warn('[Firebase] Initialization skipped. Using local in-memory storage fallback.', err);
}

export function getFirestoreDB(): admin.firestore.Firestore | null {
  return db;
}

export function isUsingCloudFirestore(): boolean {
  return isFirebaseInitialized && db !== null;
}
