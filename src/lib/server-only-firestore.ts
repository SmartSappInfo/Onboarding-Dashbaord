
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

// Server-side Firebase singleton to prevent initialization collisions
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

export function getDb() {
  const app = initializeServerApp();
  return getFirestore(app);
}

export function getServerStorage() {
    const app = initializeServerApp();
    return getStorage(app);
}
