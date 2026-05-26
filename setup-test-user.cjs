require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

try {
  const app = initializeApp({
    credential: cert('./serviceAccountKey.json'),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
  const db = getFirestore(app);
  const auth = getAuth(app);

  const email = 'testuser@smartsapp.com';
  const password = 'testpassword123';

  auth.getUserByEmail(email)
    .then((userRecord) => {
      console.log(`User ${email} already exists in Auth. Updating password...`);
      return auth.updateUser(userRecord.uid, { password });
    })
    .catch((error) => {
      if (error.code === 'auth/user-not-found') {
        console.log(`User ${email} not found in Auth. Creating...`);
        return auth.createUser({
          email,
          emailVerified: true,
          password,
          displayName: 'E2E Test User'
        });
      }
      throw error;
    })
    .then((userRecord) => {
      console.log(`Auth user configured (UID: ${userRecord.uid}). Ensuring Firestore doc...`);
      const userRef = db.collection('users').doc(userRecord.uid);
      return userRef.set({
        id: userRecord.uid,
        email: email,
        name: 'E2E Test User',
        role: 'admin',
        isAuthorized: true,
        permissions: ['system_admin'],
        workspaceIds: ['onboarding', 'business-hub', 'enrollment', 'minex-360-services', 'mining-support', 'prospect', 'research-team', 'smartsapp-staff'],
        organizationId: 'smartsapp-hq',
        profileCompleted: true,
        approvalStatus: 'approved',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    })
    .then(() => {
      console.log('SUCCESS: Test user is ready in Auth and Firestore!');
      process.exit(0);
    })
    .catch((e) => {
      console.error('ERROR:', e.message);
      process.exit(1);
    });
} catch (e) {
  console.error('INIT ERROR:', e.message);
  process.exit(1);
}
