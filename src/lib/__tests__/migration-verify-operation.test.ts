/**
 * Integration Tests for Migration Verify Operation
 * 
 * Tests the verify operation implementation without mocks to ensure it correctly:
 * - Counts records with entityId (migrated)
 * - Counts records with schoolId but no entityId (unmigrated)
 * - Checks for orphaned records (entityId doesn't exist in entities collection)
 * - Validates all migrated records have valid entityId and entityType
 * - Returns detailed verification report
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 * 
 * NOTE: These tests require Firebase Firestore emulator running on localhost:8080
 * Run with: firebase emulators:start --only firestore
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { createMigrationEngine } from '../migration-engine';

describe.skip('Migration Verify Operation - Integration Tests (Requires Firebase Emulator)', () => {
  let app: FirebaseApp;
  let firestore: Firestore;
  let testCollectionName: string;

  beforeEach(async () => {
    // Initialize Firebase with emulator
    app = initializeApp({
      projectId: 'demo-test-project',
    });

    firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, 'localhost', 8080);

    // Use unique collection name for each test
    testCollectionName = `test_tasks_${Date.now()}`;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      const collectionRef = collection(firestore, testCollectionName);
      const snapshot = await getDocs(collectionRef);
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(doc(firestore, testCollectionName, docSnapshot.id));
      }

      // Clean up entities collection
      const entitiesRef = collection(firestore, 'entities');
      const entitiesSnapshot = await getDocs(entitiesRef);
      for (const docSnapshot of entitiesSnapshot.docs) {
        if (docSnapshot.id.startsWith('entity_test_')) {
          await deleteDoc(doc(firestore, 'entities', docSnapshot.id));
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    await deleteApp(app);
  });

  describe('Requirement 20.1: Count records with entityId (migrated)', () => {
    it('should correctly count migrated records', async () => {
      // Setup: Create test records with entityId
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
        schoolId: 'school1',
      });

      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        entityId: 'entity_test_2',
        entityType: 'family',
        schoolId: 'school2',
      });

      await setDoc(doc(firestore, testCollectionName, 'task3'), {
        title: 'Task 3',
        schoolId: 'school3', // Unmigrated
      });

      // Create corresponding entities
      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_2'), {
        id: 'entity_test_2',
        name: 'Test Entity 2',
        entityType: 'family',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.migratedRecords).toBe(2);
      expect(result.totalRecords).toBe(3);
    });
  });

  describe('Requirement 20.2: Count records with schoolId but no entityId (unmigrated)', () => {
    it('should correctly count unmigrated records', async () => {
      // Setup: Create mix of migrated and unmigrated records
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
        schoolId: 'school1',
      });

      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        schoolId: 'school2', // Unmigrated
      });

      await setDoc(doc(firestore, testCollectionName, 'task3'), {
        title: 'Task 3',
        schoolId: 'school3', // Unmigrated
      });

      await setDoc(doc(firestore, testCollectionName, 'task4'), {
        title: 'Task 4',
        schoolId: 'school4', // Unmigrated
      });

      // Create entity for migrated record
      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.unmigratedRecords).toBe(3);
      expect(result.migratedRecords).toBe(1);
      expect(result.totalRecords).toBe(4);
    });
  });

  describe('Requirement 20.5: Check for orphaned records', () => {
    it('should identify orphaned records where entityId does not exist in entities collection', async () => {
      // Setup: Create record with entityId but no corresponding entity
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_orphaned',
        entityType: 'institution',
        schoolId: 'school1',
      });

      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        entityId: 'entity_test_2',
        entityType: 'family',
        schoolId: 'school2',
      });

      // Create entity only for task2
      await setDoc(doc(firestore, 'entities', 'entity_test_2'), {
        id: 'entity_test_2',
        name: 'Test Entity 2',
        entityType: 'family',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.orphanedRecords).toBe(1);
      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].recordId).toBe('task1');
      expect(result.validationErrors[0].field).toBe('entityId');
      expect(result.validationErrors[0].issue).toContain('does not exist');
    });

    it('should not count records as orphaned if entity exists', async () => {
      // Setup: Create records with valid entities
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.orphanedRecords).toBe(0);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('Requirement 20.3: Validate all migrated records have valid entityId', () => {
    it('should detect empty entityId values', async () => {
      // Setup: Create record with empty entityId
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: '',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].recordId).toBe('task1');
      expect(result.validationErrors[0].field).toBe('entityId');
      expect(result.validationErrors[0].issue).toBe('Empty entityId value');
    });

    it('should detect whitespace-only entityId values', async () => {
      // Setup: Create record with whitespace entityId
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: '   ',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].field).toBe('entityId');
      expect(result.validationErrors[0].issue).toBe('Empty entityId value');
    });
  });

  describe('Requirement 20.4: Validate all migrated records have valid entityType', () => {
    it('should detect missing entityType', async () => {
      // Setup: Create record without entityType
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.validationErrors.some(e => 
        e.recordId === 'task1' && 
        e.field === 'entityType' && 
        e.issue === 'Missing entityType'
      )).toBe(true);
    });

    it('should detect invalid entityType values', async () => {
      // Setup: Create record with invalid entityType
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'invalid_type',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result.validationErrors.some(e => 
        e.recordId === 'task1' && 
        e.field === 'entityType' && 
        e.issue.includes('Invalid entityType')
      )).toBe(true);
    });

    it('should accept valid entityType values', async () => {
      // Setup: Create records with all valid entityType values
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        entityId: 'entity_test_2',
        entityType: 'family',
      });

      await setDoc(doc(firestore, testCollectionName, 'task3'), {
        title: 'Task 3',
        entityId: 'entity_test_3',
        entityType: 'person',
      });

      // Create corresponding entities
      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_2'), {
        id: 'entity_test_2',
        name: 'Test Entity 2',
        entityType: 'family',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_3'), {
        id: 'entity_test_3',
        name: 'Test Entity 3',
        entityType: 'person',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify - no validation errors for entityType
      const entityTypeErrors = result.validationErrors.filter(e => e.field === 'entityType');
      expect(entityTypeErrors).toHaveLength(0);
    });
  });

  describe('Requirement 20.5: Return detailed verification report', () => {
    it('should return comprehensive verification report with all metrics', async () => {
      // Setup: Create diverse set of records
      // 1. Valid migrated record
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
        schoolId: 'school1',
      });

      // 2. Unmigrated record
      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        schoolId: 'school2',
      });

      // 3. Orphaned record
      await setDoc(doc(firestore, testCollectionName, 'task3'), {
        title: 'Task 3',
        entityId: 'entity_orphaned',
        entityType: 'family',
      });

      // 4. Invalid entityType
      await setDoc(doc(firestore, testCollectionName, 'task4'), {
        title: 'Task 4',
        entityId: 'entity_test_4',
        entityType: 'invalid',
      });

      // 5. Empty entityId
      await setDoc(doc(firestore, testCollectionName, 'task5'), {
        title: 'Task 5',
        entityId: '',
        entityType: 'person',
      });

      // Create valid entities
      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_4'), {
        id: 'entity_test_4',
        name: 'Test Entity 4',
        entityType: 'person',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify comprehensive report
      expect(result).toMatchObject({
        collection: testCollectionName,
        totalRecords: 5,
        migratedRecords: 4, // task1, task3, task4, task5 have entityId
        unmigratedRecords: 1, // task2 only has schoolId
        orphanedRecords: 1, // task3 has non-existent entity
      });

      // Should have multiple validation errors
      expect(result.validationErrors.length).toBeGreaterThan(0);
      
      // Check for specific error types
      const hasOrphanedError = result.validationErrors.some(e => 
        e.issue.includes('does not exist')
      );
      const hasInvalidTypeError = result.validationErrors.some(e => 
        e.issue.includes('Invalid entityType')
      );
      const hasEmptyIdError = result.validationErrors.some(e => 
        e.issue.includes('Empty entityId')
      );

      expect(hasOrphanedError).toBe(true);
      expect(hasInvalidTypeError).toBe(true);
      expect(hasEmptyIdError).toBe(true);
    });

    it('should return clean report for fully migrated collection', async () => {
      // Setup: Create only valid migrated records
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: 'entity_test_1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, testCollectionName, 'task2'), {
        title: 'Task 2',
        entityId: 'entity_test_2',
        entityType: 'family',
      });

      // Create corresponding entities
      await setDoc(doc(firestore, 'entities', 'entity_test_1'), {
        id: 'entity_test_1',
        name: 'Test Entity 1',
        entityType: 'institution',
      });

      await setDoc(doc(firestore, 'entities', 'entity_test_2'), {
        id: 'entity_test_2',
        name: 'Test Entity 2',
        entityType: 'family',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify clean report
      expect(result).toMatchObject({
        collection: testCollectionName,
        totalRecords: 2,
        migratedRecords: 2,
        unmigratedRecords: 0,
        orphanedRecords: 0,
        validationErrors: [],
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty collection', async () => {
      // Execute on empty collection
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify
      expect(result).toMatchObject({
        collection: testCollectionName,
        totalRecords: 0,
        migratedRecords: 0,
        unmigratedRecords: 0,
        orphanedRecords: 0,
        validationErrors: [],
      });
    });

    it('should handle records with neither schoolId nor entityId', async () => {
      // Setup: Create record without identifiers
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        description: 'No identifiers',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify - should not count as migrated or unmigrated
      expect(result.totalRecords).toBe(1);
      expect(result.migratedRecords).toBe(0);
      expect(result.unmigratedRecords).toBe(0);
    });

    it('should handle multiple validation errors for same record', async () => {
      // Setup: Create record with multiple issues
      await setDoc(doc(firestore, testCollectionName, 'task1'), {
        title: 'Task 1',
        entityId: '',
        entityType: 'invalid_type',
      });

      // Execute
      const engine = createMigrationEngine(firestore);
      const result = await engine.verify(testCollectionName);

      // Verify - should have multiple errors for task1
      const task1Errors = result.validationErrors.filter(e => e.recordId === 'task1');
      expect(task1Errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
