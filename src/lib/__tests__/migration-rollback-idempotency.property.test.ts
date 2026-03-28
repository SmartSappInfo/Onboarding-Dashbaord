/**
 * Property Test: Rollback Idempotency
 * 
 * Property 18: For any rollback operation, running the operation multiple times 
 * should produce the same final state without errors.
 * 
 * Validates: Requirements 21.6
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

describe('Property 18: Rollback Idempotency', () => {
  let testEnv: any;
  let firestore: any;

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `test-rollback-idempotency-${Date.now()}`,
    });
    firestore = testEnv.unauthenticatedContext().firestore();
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('should produce the same result when run multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities', 'forms'),
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
        fc.integer({ min: 2, max: 5 }), // Number of times to run rollback
        async (collectionName, records, runCount) => {
          // Setup: Create migrated records and backups
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          for (const record of records) {
            // Create migrated record
            await setDoc(doc(firestore, collectionName, record.id), {
              ...record,
              entityId: `entity_${record.schoolId}`,
              entityType: 'institution' as const,
            });

            // Create backup
            await setDoc(doc(firestore, backupCollectionName, record.id), {
              ...record,
              backedUpAt: new Date().toISOString(),
            });
          }

          const migrationEngine = createMigrationEngine(firestore);
          const results = [];

          // Execute: Run rollback multiple times
          for (let i = 0; i < runCount; i++) {
            const result = await migrationEngine.rollback(collectionName);
            results.push(result);

            // After first run, backup should be deleted
            if (i === 0) {
              expect(result.totalRestored).toBe(records.length);
              expect(result.failed).toBe(0);
            } else {
              // Subsequent runs should return empty results (no backup exists)
              expect(result.totalRestored).toBe(0);
              expect(result.failed).toBe(0);
            }
          }

          // Verify: Final state is consistent
          const finalSnapshot = await getDocs(collection(firestore, collectionName));
          const finalRecords = finalSnapshot.docs.map(d => d.data());

          // All records should be in pre-migration state
          for (const finalRecord of finalRecords) {
            expect(finalRecord.entityId).toBeUndefined();
            expect(finalRecord.entityType).toBeUndefined();
            expect(finalRecord.schoolId).toBeDefined();
          }

          // Verify: Backup collection deleted after first run
          const backupSnapshot = await getDocs(collection(firestore, backupCollectionName));
          expect(backupSnapshot.empty).toBe(true);

          // Cleanup
          for (const doc of finalSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not error when run on already rolled-back collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            schoolId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (collectionName, records) => {
          // Setup: Create backup and perform first rollback
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          for (const record of records) {
            await setDoc(doc(firestore, backupCollectionName, record.id), {
              ...record,
              backedUpAt: new Date().toISOString(),
            });
          }

          const migrationEngine = createMigrationEngine(firestore);

          // First rollback
          const result1 = await migrationEngine.rollback(collectionName);
          expect(result1.totalRestored).toBe(records.length);
          expect(result1.failed).toBe(0);

          // Verify backup deleted
          const backupAfterFirst = await getDocs(collection(firestore, backupCollectionName));
          expect(backupAfterFirst.empty).toBe(true);

          // Execute: Second rollback (no backup exists)
          const result2 = await migrationEngine.rollback(collectionName);

          // Verify: No errors, returns empty result
          expect(result2.totalRestored).toBe(0);
          expect(result2.failed).toBe(0);
          expect(result2.errors).toHaveLength(0);

          // Verify: Records still in rolled-back state
          const finalSnapshot = await getDocs(collection(firestore, collectionName));
          for (const doc of finalSnapshot.docs) {
            const data = doc.data();
            expect(data.entityId).toBeUndefined();
            expect(data.entityType).toBeUndefined();
          }

          // Cleanup
          for (const doc of finalSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain data consistency across multiple rollback attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('forms', 'invoices'),
        fc.record({
          id: fc.uuid(),
          workspaceId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          schoolId: fc.uuid(),
          schoolName: fc.string({ minLength: 1, maxLength: 30 }),
          customData: fc.string(),
        }),
        async (collectionName, record) => {
          // Setup: Create migrated record and backup
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          await setDoc(doc(firestore, collectionName, record.id), {
            ...record,
            entityId: `entity_${record.schoolId}`,
            entityType: 'institution' as const,
          });

          await setDoc(doc(firestore, backupCollectionName, record.id), {
            ...record,
            backedUpAt: new Date().toISOString(),
          });

          const migrationEngine = createMigrationEngine(firestore);

          // Execute: Multiple rollback attempts
          await migrationEngine.rollback(collectionName);
          await migrationEngine.rollback(collectionName);
          await migrationEngine.rollback(collectionName);

          // Verify: Data integrity maintained
          const finalSnapshot = await getDocs(collection(firestore, collectionName));
          expect(finalSnapshot.size).toBe(1);

          const finalData = finalSnapshot.docs[0].data();
          expect(finalData.id).toBe(record.id);
          expect(finalData.workspaceId).toBe(record.workspaceId);
          expect(finalData.title).toBe(record.title);
          expect(finalData.schoolId).toBe(record.schoolId);
          expect(finalData.schoolName).toBe(record.schoolName);
          expect(finalData.customData).toBe(record.customData);
          expect(finalData.entityId).toBeUndefined();
          expect(finalData.entityType).toBeUndefined();

          // Cleanup
          await deleteDoc(doc(firestore, collectionName, record.id));
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle concurrent rollback attempts safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            schoolId: fc.uuid(),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (collectionName, records) => {
          // Setup: Create backup
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          for (const record of records) {
            await setDoc(doc(firestore, backupCollectionName, record.id), {
              ...record,
              backedUpAt: new Date().toISOString(),
            });
          }

          const migrationEngine = createMigrationEngine(firestore);

          // Execute: Concurrent rollback attempts
          const rollbackPromises = [
            migrationEngine.rollback(collectionName),
            migrationEngine.rollback(collectionName),
            migrationEngine.rollback(collectionName),
          ];

          const results = await Promise.all(rollbackPromises);

          // Verify: At least one succeeded
          const successfulResults = results.filter(r => r.totalRestored > 0);
          expect(successfulResults.length).toBeGreaterThanOrEqual(1);

          // Verify: Final state is consistent
          const finalSnapshot = await getDocs(collection(firestore, collectionName));
          for (const doc of finalSnapshot.docs) {
            const data = doc.data();
            expect(data.entityId).toBeUndefined();
            expect(data.entityType).toBeUndefined();
          }

          // Cleanup
          for (const doc of finalSnapshot.docs) {
            await deleteDoc(doc.ref);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
