import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
  });
}

const db = getFirestore();
const auth = getAuth();

async function createAdminUser() {
  try {
    // Get the UID for admin@smartsapp.com
    const userRecord = await auth.getUserByEmail('admin@smartsapp.com');
    const uid = userRecord.uid;
    
    console.log(`Found user with UID: ${uid}`);
    
    // Create/update user document
    await db.collection('users').doc(uid).set({
      email: 'admin@smartsapp.com',
      name: 'Default Admin',
      isAuthorized: true,
      permissions: ['system_admin'],
      workspaceIds: [],
      organizationId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('✅ Admin user document created/updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser();
