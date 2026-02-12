
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// This is a server-side only utility to prevent client-side bundle inclusion.

/**
 * Initializes and returns a Firestore instance for use in server-side logic (Server Actions, API Routes).
 */
export function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}
