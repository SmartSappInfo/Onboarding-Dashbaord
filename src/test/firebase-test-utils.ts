/**
 * Firebase Test Utilities
 * 
 * Provides utilities for testing with Firebase emulator
 */

import { initializeApp, getApps, deleteApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

let testFirestore: Firestore | null = null;

/**
 * Initialize Firebase Admin for testing with emulator
 */
export function initializeTestFirebase(): Firestore {
  // Return existing instance if already initialized
  if (testFirestore) {
    return testFirestore;
  }

  // Set emulator environment variables
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  // Clean up any existing apps
  const existingApps = getApps();
  existingApps.forEach((app) => {
    deleteApp(app);
  });

  // Initialize with minimal config for emulator
  const app = initializeApp({
    projectId: 'test-project',
  });

  testFirestore = getFirestore(app);
  
  // Configure Firestore settings for emulator
  testFirestore.settings({
    host: 'localhost:8080',
    ssl: false,
    ignoreUndefinedProperties: true,
  });

  return testFirestore;
}

/**
 * Get the test Firestore instance
 */
export function getTestFirestore(): Firestore {
  if (!testFirestore) {
    return initializeTestFirebase();
  }
  return testFirestore;
}

/**
 * Clear all data from Firestore emulator
 */
export async function clearFirestoreData(): Promise<void> {
  const db = getTestFirestore();
  
  // Get all collections
  const collections = await db.listCollections();
  
  // Delete all documents in each collection
  const deletePromises = collections.map(async (collection) => {
    const snapshot = await collection.get();
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  });
  
  await Promise.all(deletePromises);
}

/**
 * Seed test data into Firestore
 */
export async function seedTestData(data: {
  organizations?: any[];
  workspaces?: any[];
  users?: any[];
  entities?: any[];
  workspace_entities?: any[];
  tags?: any[];
  [key: string]: any[] | undefined;
}): Promise<void> {
  const db = getTestFirestore();
  
  for (const [collectionName, documents] of Object.entries(data)) {
    if (!documents || documents.length === 0) continue;
    
    const batch = db.batch();
    
    for (const doc of documents) {
      const { id, ...docData } = doc;
      const docRef = db.collection(collectionName).doc(id || db.collection(collectionName).doc().id);
      batch.set(docRef, docData);
    }
    
    await batch.commit();
  }
}

/**
 * Wait for emulator to be ready
 */
export async function waitForEmulator(maxAttempts = 10, delayMs = 1000): Promise<boolean> {
  const db = getTestFirestore();
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Try to perform a simple operation
      await db.collection('_health_check').doc('test').set({ timestamp: Date.now() });
      await db.collection('_health_check').doc('test').delete();
      return true;
    } catch (error) {
      if (i === maxAttempts - 1) {
        console.error('Firebase emulator not ready after', maxAttempts, 'attempts');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false;
}

/**
 * Cleanup Firebase after tests
 */
export async function cleanupTestFirebase(): Promise<void> {
  if (testFirestore) {
    await clearFirestoreData();
    testFirestore = null;
  }
  
  const apps = getApps();
  await Promise.all(apps.map(app => deleteApp(app)));
}

/**
 * Create a test transaction helper
 */
export async function runTestTransaction<T>(
  callback: (transaction: FirebaseFirestore.Transaction) => Promise<T>
): Promise<T> {
  const db = getTestFirestore();
  return db.runTransaction(callback);
}

/**
 * Get a document reference for testing
 */
export function getTestDocRef(collection: string, docId: string) {
  const db = getTestFirestore();
  return db.collection(collection).doc(docId);
}

/**
 * Get a collection reference for testing
 */
export function getTestCollectionRef(collection: string) {
  const db = getTestFirestore();
  return db.collection(collection);
}

/**
 * Mock Firebase Admin for tests that don't need emulator
 */
export function mockFirebaseAdmin() {
  const mockDoc = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
      id: 'mock-id',
    }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockCollection = {
    doc: vi.fn().mockReturnValue(mockDoc),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    }),
    add: vi.fn().mockResolvedValue(mockDoc),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
    doc: vi.fn().mockReturnValue(mockDoc),
    runTransaction: vi.fn().mockImplementation((callback) => callback({
      get: vi.fn().mockResolvedValue(mockDoc),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    batch: vi.fn().mockReturnValue({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
  };

  return { mockDb, mockCollection, mockDoc };
}
