import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-9220106300-f74cb.appspot.com';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'studio-9220106300-f74cb';

  // Try service account key from environment variable
  if (serviceAccountKey) {
    try {
      if (serviceAccountKey.trim().startsWith('{')) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        return initializeApp({
          credential: cert(serviceAccount),
          storageBucket,
          projectId: serviceAccount.project_id || projectId,
        });
      } else {
        console.warn(">>> [BOOTSTRAP] FIREBASE_SERVICE_ACCOUNT_KEY does not appear to be valid JSON.");
      }
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e instanceof Error ? e.message : 'Unknown error');
    }
  }

  // Try service account key from file path
  if (serviceAccountPath) {
    try {
      return initializeApp({
        credential: cert(serviceAccountPath),
        storageBucket,
        projectId,
      });
    } catch (e) {
      console.error("Failed to load service account from path:", e instanceof Error ? e.message : 'Unknown error');
    }
  }

  // Fallback for production environments with ambient credentials
  console.warn(">>> [BOOTSTRAP] No valid service account credentials found. Using ambient credentials (may fail in development).");
  return initializeApp({
    projectId,
    storageBucket,
  });
}

const app = getAdminApp();

export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app).bucket();
