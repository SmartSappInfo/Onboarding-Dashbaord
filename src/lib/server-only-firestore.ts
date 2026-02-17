
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

// This is a server-side only utility to prevent client-side bundle inclusion.

function initializeServerApp(): FirebaseApp {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApp();
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
