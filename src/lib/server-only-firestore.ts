import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

// This is a server-side only utility to prevent client-side bundle inclusion.
// It uses a singleton pattern to ensure only one Firebase instance exists per request.

let serverApp: FirebaseApp | null = null;

function initializeServerApp(): FirebaseApp {
  if (serverApp) return serverApp;

  const apps = getApps();
  if (apps.length > 0) {
    serverApp = apps[0];
  } else {
    console.log(">>> [SERVER:FIREBASE] Initializing new Firebase App instance...");
    serverApp = initializeApp(firebaseConfig);
  }
  return serverApp!;
}

/**
 * Initializes and returns a Firestore instance for use in server-side logic (Server Actions, API Routes).
 */
export function getDb() {
  const app = initializeServerApp();
  return getFirestore(app);
}

/**
 * Initializes and returns a Storage instance for use in server-side logic (Server Actions, API Routes).
 */
export function getServerStorage() {
    const app = initializeServerApp();
    return getStorage(app);
}
