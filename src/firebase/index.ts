'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager 
} from 'firebase/firestore';

export interface FirebaseSdks {
  firebaseApp: FirebaseApp;
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
}

let cachedSdks: FirebaseSdks | null = null;

export function initializeFirebase(): FirebaseSdks {
  if (cachedSdks && getApps().length > 0) {
    return cachedSdks;
  }

  if (!getApps().length) {
    const useAppHostingAutoInit = process.env.NEXT_PUBLIC_FIREBASE_APP_HOSTING === 'true';
    let firebaseApp: FirebaseApp;

    if (useAppHostingAutoInit) {
      try {
        firebaseApp = initializeApp();
      } catch (e) {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
        firebaseApp = initializeApp(firebaseConfig);
      }
    } else {
      firebaseApp = initializeApp(firebaseConfig);
    }

    cachedSdks = getSdks(firebaseApp);
    return cachedSdks;
  }

  // If already initialized, return the SDKs with the already initialized App
  cachedSdks = getSdks(getApp());
  return cachedSdks;
}

export function getSdks(firebaseApp: FirebaseApp): FirebaseSdks {
  if (cachedSdks && cachedSdks.firebaseApp === firebaseApp) {
    return cachedSdks;
  }

  let db: ReturnType<typeof getFirestore>;
  try {
    if (typeof window !== 'undefined') {
      try {
        db = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          experimentalAutoDetectLongPolling: true,
        });
      } catch {
        try {
          db = getFirestore(firebaseApp);
        } catch {
          db = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
        }
      }
    } else {
      db = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
    }
  } catch {
    db = getFirestore(firebaseApp);
  }

  const sdks: FirebaseSdks = {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: db
  };

  cachedSdks = sdks;
  return sdks;
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
