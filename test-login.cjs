const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  "projectId": "studio-9220106300-f74cb",
  "appId": "1:767767851953:web:c470ec7ce5871eac47c390",
  "apiKey": "AIzaSyBTLoeIHT_dzvUdX7QdgIMT4fTjahABXZM",
  "authDomain": "studio-9220106300-f74cb.firebaseapp.com",
  "storageBucket": "studio-9220106300-f74cb.firebasestorage.app",
  "messagingSenderId": "767767851953"
};

console.log('Firebase Config ProjectId:', firebaseConfig.projectId);

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  console.log('Attempting sign in with testuser@smartsapp.com...');
  signInWithEmailAndPassword(auth, 'testuser@smartsapp.com', 'testpassword123')
    .then((userCredential) => {
      console.log('SUCCESS: Logged in successfully! User UID:', userCredential.user.uid);
      process.exit(0);
    })
    .catch((error) => {
      console.error('LOGIN ERROR Code:', error.code);
      console.error('LOGIN ERROR Message:', error.message);
      process.exit(1);
    });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
