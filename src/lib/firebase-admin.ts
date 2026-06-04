import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
        if (process.env.NODE_ENV !== 'production') {
          console.warn(">>> [BOOTSTRAP] FIREBASE_SERVICE_ACCOUNT_KEY does not appear to be valid JSON.");
        }
      }
    } catch (e) {
      // Suppress parse errors during build - they're expected when workers initialize
      if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PHASE) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e instanceof Error ? e.message : 'Unknown error');
      }
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

const firestoreInstance = getFirestore(app);

// settings() can only be called once per instance before any other operations.
// We guard it with a global check and try/catch to prevent Next.js build-time re-evaluation failures.
if (!(globalThis as any)._firestoreSettingsApplied) {
  try {
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
    (globalThis as any)._firestoreSettingsApplied = true;
  } catch (e: any) {
    if (e.message && e.message.includes('already been initialized')) {
      (globalThis as any)._firestoreSettingsApplied = true;
    } else {
      throw e;
    }
  }
}

export const adminDb = firestoreInstance;
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app).bucket();
export { FieldValue };
