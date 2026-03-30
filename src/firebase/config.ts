
export const firebaseConfig = {
  "projectId": "studio-9220106300-f74cb",
  "appId": "1:767767851953:web:c470ec7ce5871eac47c390",
  "apiKey": "AIzaSyBTLoeIHT_dzvUdX7QdgIMT4fTjahABXZM",
  "authDomain": "studio-9220106300-f74cb.firebaseapp.com",
  "storageBucket": "studio-9220106300-f74cb.appspot.com",
  "measurementId": "",
  "messagingSenderId": "767767851953"
};

// Re-export firestore for test compatibility
import { getFirestore } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

let _firestore: ReturnType<typeof getFirestore> | null = null;

export const firestore = (() => {
  if (_firestore) return _firestore;
  
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  _firestore = getFirestore(app);
  return _firestore;
})();
