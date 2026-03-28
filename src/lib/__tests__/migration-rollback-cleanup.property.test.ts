/**
 * Property Test: Rollback Cleanup
 * 
 * Property 17: For any successful rollback operation, the system should delete 
 * the corresponding backup_<collection>_entity_migration collection.
 * 
 * Validates: Requirements 21.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc
} from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createMigrationEngine } from '../migration-engine';

describe('Property 17: Rollback Cleanup', () => {
  let testEnv: any;
  let firestore: any;

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `test-rollback-cleanup-${Date.now()}`,
    });
    firestore = testEnv.unauthenticatedContext().firestore();
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('should delete backup collection after successful rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities', 'forms', 'invoices'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            schoolId: fc.uuid(),
            schoolName: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (collectionName, records) => {
          // Setup: Create backup collection
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          for (const record of records) {
            await setDoc(doc(firestore, backupCollectionName, record.id), {
              ...record,
              backedUpAt: new Date().toISOString(),
            });
          }

          // Verify backup exists before rollback
          const backupBeforeSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupBeforeSnapshot.empty).toBe(false);
          expect(backupBeforeSnapshot.size).toBe(records.length);

          // Execute: Rollback
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: Rollback succeeded
          expect(result.failed).toBe(0);

          // Verify: Backup collection is deleted
          const backupAfterSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupAfterSnapshot.empty).toBe(true);
          expect(backupAfterSnapshot.size).toBe(0);

          // Cleanup main collection
          const mainSnapshot = await getDocs(collection(firestore, collectionName));
          for (const doc of mainSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should NOT delete backup collection if rollback has failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 3, maxLength: 5 }
        ),
        async (collectionName, records) => {
          // Setup: Create backup collection with one invalid record
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          for (let i = 0; i < records.length; i++) {
            const record = records[i];
            // Make the first record invalid (missing critical fields)
            const backupData = i === 0
              ? { id: record.id, backedUpAt: new Date().toISOString() } // Invalid
              : { ...record, schoolId: `school_${i}`, backedUpAt: new Date().toISOString() };
            
            await setDoc(doc(firestore, backupCollectionName, record.id), backupData);
          }

          // Execute: Rollback (will have failures)
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: Some failures occurred
          expect(result.failed).toBeGreaterThan(0);

          // Verify: Backup collection still exists (not deleted due to failures)
          const backupAfterSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupAfterSnapshot.empty).toBe(false);
          expect(backupAfterSnapshot.size).toBe(records.length);

          // Cleanup
          for (const doc of backupAfterSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
          
          const mainSnapshot = await getDocs(collection(firestore, collectionName));
          for (const doc of mainSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should delete all documents in backup collection regardless of size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'forms'),
        fc.integer({ min: 1, max: 50 }), // Test with varying collection sizes
        async (collectionName, recordCount) => {
          // Setup: Create backup collection with many records
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          const records = [];
          
          for (let i = 0; i < recordCount; i++) {
            const record = {
              id: `record_${i}`,
              workspaceId: `workspace_${i % 5}`,
              title: `Title ${i}`,
              schoolId: `school_${i}`,
              backedUpAt: new Date().toISOString(),
            };
            records.push(record);
            await setDoc(doc(firestore, backupCollectionName, record.id), record);
          }

          // Verify backup exists
          const backupBeforeSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupBeforeSnapshot.size).toBe(recordCount);

          // Execute: Rollback
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: All records restored successfully
          expect(result.failed).toBe(0);
          expect(result.totalRestored).toBe(recordCount);

          // Verify: Backup collection completely deleted
          const backupAfterSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupAfterSnapshot.empty).toBe(true);

          // Cleanup main collection
          const mainSnapshot = await getDocs(collection(firestore, collectionName));
          for (const doc of mainSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should handle empty backup collections gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities', 'forms'),
        async (collectionName) => {
          // Setup: No backup collection exists (or empty)
          const backupCollectionName = `backup_${collectionName}_entity_migration`;

          // Execute: Rollback on non-existent backup
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: Returns empty result without errors
          expect(result.totalRestored).toBe(0);
          expect(result.failed).toBe(0);
          expect(result.errors).toHaveLength(0);

          // Verify: No backup collection created
          const backupSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupSnapshot.empty).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });
});
