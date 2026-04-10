/**
 * Property Test: Rollback Restoration
 * 
 * Property 16: For any feature collection with a backup collection, the rollback 
 * operation should restore all records to their pre-migration state by copying data 
 * from backup_<collection>_entity_migration and removing the entityId and entityType fields.
 * 
 * Validates: Requirements 21.2, 21.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createMigrationEngine } from '../migration-engine';

describe('Property 16: Rollback Restoration', () => {
  let testEnv: any;
  let firestore: any;

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `test-rollback-restoration-${Date.now()}`,
    });
    firestore = testEnv.unauthenticatedContext().firestore();
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('should restore all records to pre-migration state by removing entityId and entityType', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate collection name
        fc.constantFrom('tasks', 'activities', 'forms', 'invoices', 'meetings'),
        // Generate array of records with original data
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            entityId: fc.uuid(),
            entityName: fc.string({ minLength: 1, maxLength: 30 }),
            status: fc.constantFrom('active', 'completed', 'pending'),
            createdAt: fc.date().map(d => d.toISOString()),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (collectionName, originalRecords) => {
          // Setup: Create migrated records (with entityId and entityType)
          const migratedRecords = originalRecords.map(record => ({
            ...record,
            entityId: `entity_${record.entityId}`,
            entityType: 'institution' as const,
            updatedAt: new Date().toISOString(),
          }));

          // Create migrated records in main collection
          for (const record of migratedRecords) {
            await setDoc(doc(firestore, collectionName, record.id), record);
          }

          // Create backup records (original state before migration)
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          for (const record of originalRecords) {
            await setDoc(doc(firestore, backupCollectionName, record.id), {
              ...record,
              backedUpAt: new Date().toISOString(),
            });
          }

          // Execute: Rollback
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: All records restored
          expect(result.totalRestored).toBe(originalRecords.length);
          expect(result.failed).toBe(0);
          expect(result.errors).toHaveLength(0);

          // Verify: Records in main collection match original state
          const restoredSnapshot = await getDocs(collection(firestore, collectionName));
          const restoredRecords = restoredSnapshot.docs.map(d => d.data());

          for (const restoredRecord of restoredRecords) {
            const originalRecord = originalRecords.find(r => r.id === restoredRecord.id);
            expect(originalRecord).toBeDefined();

            // Should NOT have entityId or entityType
            expect(restoredRecord.entityId).toBeUndefined();
            expect(restoredRecord.entityType).toBeUndefined();

            // Should have original fields
            expect(restoredRecord.entityId).toBe(originalRecord!.entityId);
            expect(restoredRecord.entityName).toBe(originalRecord!.entityName);
            expect(restoredRecord.title).toBe(originalRecord!.title);
            expect(restoredRecord.status).toBe(originalRecord!.status);
          }

          // Cleanup
          for (const record of originalRecords) {
            await deleteDoc(doc(firestore, collectionName, record.id));
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle partial failures gracefully and continue restoring remaining records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            entityId: fc.uuid(),
          }),
          { minLength: 5, maxLength: 10 }
        ),
        async (collectionName, records) => {
          // Setup: Create backup records
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          
          // Create valid backup records
          for (let i = 0; i < records.length; i++) {
            const record = records[i];
            // Make one record invalid (missing required field)
            const backupData = i === 2 
              ? { id: record.id, backedUpAt: new Date().toISOString() } // Invalid - missing fields
              : { ...record, backedUpAt: new Date().toISOString() };
            
            await setDoc(doc(firestore, backupCollectionName, record.id), backupData);
          }

          // Execute: Rollback
          const migrationEngine = createMigrationEngine(firestore);
          const result = await migrationEngine.rollback(collectionName);

          // Verify: Some records restored, some failed
          expect(result.totalRestored + result.failed).toBe(records.length);
          expect(result.totalRestored).toBeGreaterThan(0);

          // Cleanup
          const backupSnapshot = await getDocs(collection(firestore, backupCollectionName));
          for (const doc of backupSnapshot.docs) {
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

  it('should preserve all original fields except entityId and entityType during rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'forms'),
        fc.record({
          id: fc.uuid(),
          workspaceId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 0, maxLength: 200 }),
          entityId: fc.uuid(),
          entityName: fc.string({ minLength: 1, maxLength: 30 }),
          status: fc.constantFrom('active', 'completed'),
          priority: fc.constantFrom('low', 'medium', 'high'),
          assignedTo: fc.uuid(),
          dueDate: fc.date().map(d => d.toISOString()),
          createdAt: fc.date().map(d => d.toISOString()),
          customField1: fc.string(),
          customField2: fc.integer(),
        }),
        async (collectionName, originalRecord) => {
          // Setup: Create migrated record
          const migratedRecord = {
            ...originalRecord,
            entityId: `entity_${originalRecord.entityId}`,
            entityType: 'institution' as const,
          };
          await setDoc(doc(firestore, collectionName, originalRecord.id), migratedRecord);

          // Create backup
          const backupCollectionName = `backup_${collectionName}_entity_migration`;
          await setDoc(doc(firestore, backupCollectionName, originalRecord.id), {
            ...originalRecord,
            backedUpAt: new Date().toISOString(),
          });

          // Execute: Rollback
          const migrationEngine = createMigrationEngine(firestore);
          await migrationEngine.rollback(collectionName);

          // Verify: Restored record matches original (except entityId/entityType)
          const restoredSnapshot = await getDocs(collection(firestore, collectionName));
          const restoredRecord = restoredSnapshot.docs[0]?.data();

          expect(restoredRecord).toBeDefined();
          expect(restoredRecord.entityId).toBeUndefined();
          expect(restoredRecord.entityType).toBeUndefined();

          // All original fields preserved
          expect(restoredRecord.workspaceId).toBe(originalRecord.workspaceId);
          expect(restoredRecord.title).toBe(originalRecord.title);
          expect(restoredRecord.description).toBe(originalRecord.description);
          expect(restoredRecord.entityId).toBe(originalRecord.entityId);
          expect(restoredRecord.entityName).toBe(originalRecord.entityName);
          expect(restoredRecord.status).toBe(originalRecord.status);
          expect(restoredRecord.priority).toBe(originalRecord.priority);
          expect(restoredRecord.assignedTo).toBe(originalRecord.assignedTo);
          expect(restoredRecord.dueDate).toBe(originalRecord.dueDate);
          expect(restoredRecord.customField1).toBe(originalRecord.customField1);
          expect(restoredRecord.customField2).toBe(originalRecord.customField2);

          // Cleanup
          await deleteDoc(doc(firestore, collectionName, originalRecord.id));
        }
      ),
      { numRuns: 10 }
    );
  });
});
