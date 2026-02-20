
import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // On Firebase App Hosting or other Google Cloud environments, we can often initialize without credentials
  // For local development, FIREBASE_SERVICE_ACCOUNT_KEY should be set in .env
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-9220106300-f74cb.appspot.com';

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      return initializeApp({
        credential: cert(serviceAccount),
        storageBucket,
      });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // Fallback for production environments with ambient credentials
  return initializeApp({
    storageBucket,
  });
}

const app = getAdminApp();

export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app).bucket();
