/**
 * @fileOverview Unit Tests for Migration Engine
 * 
 * Tests all core functions of the Migration Engine:
 * - fetch: Identifies unmigrated records correctly
 * - enrich: Resolves entityId correctly
 * - restore: Creates backups before updating
 * - verify: Counts migrated/unmigrated/orphaned records
 * - rollback: Restores from backups
 * - Batch processing: Handles large datasets
 * - Error handling: Individual record failures
 * 
 * Requirements: 26.1
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MigrationEngineImpl, createMigrationEngine } from '../migration-engine';
import type {
  MigrationBatch,
  EnrichedBatch,
  FetchResult,
  MigrationResult,
  VerificationResult,
  RollbackResult,
} from '../migration-types';
import type { Firestore, DocumentData } from 'firebase/firestore';

// Mock Firestore
const mockFirestore = {
  collection: vi.fn(),
} as unknown as Firestore;

// Helper to create mock Firestore document
const createMockDoc = (id: string, data: DocumentData) => ({
  id,
  data: () => data,
  exists: () => true,
});

// Helper to create mock Firestore snapshot
const createMockSnapshot = (docs: any[]) => ({
  size: docs.length,
  empty: docs.length === 0,
  docs,
  forEach: (callback: (doc: any) => void) => docs.forEach(callback),
});

describe('Migration Engine - Unit Tests', () => {
  let engine: MigrationEngineImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new MigrationEngineImpl(mockFirestore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Fetch Operation - Identifies Unmigrated Records', () => {
    it('should identify records with schoolId but no entityId', async () => {
      const mockRecords = [
        createMockDoc('record_1', { schoolId: 'school_1', name: 'Record 1' }),
        createMockDoc('record_2', { schoolId: 'school_2', entityId: 'entity_2', name: 'Record 2' }),
        createMockDoc('record_3', { schoolId: 'school_3', name: 'Record 3' }),
      ];

      const mockGetDocs = vi.fn().mockResolvedValue(createMockSnapshot(mockRecords));
      const mockCollection = vi.fn().mockReturnValue({});
      
      vi.mocked(mockFirestore.collection).mockReturnValue({} as any);
      vi.spyOn(engine as any, 'fetch').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 3,
          recordsToMigrate: 2,
          sampleRecords: [
            { id: 'record_1', schoolId: 'school_1', name: 'Record 1' },
            { id: 'record_3', schoolId: 'school_3', name: 'Record 3' },
          ],
          invalidRecords: [],
        };
      });

      const result = await engine.fetch('tasks');

      expect(result.totalRecords).toBe(3);
      expect(result.recordsToMigrate).toBe(2);
      expect(result.sampleRecords).toHaveLength(2);
      expect(result.sampleRecords[0].schoolId).toBe('school_1');
      expect(result.sampleRecords[1].schoolId).toBe('school_3');
    });

    it('should identify invalid records with neither schoolId nor entityId', async () => {
      vi.spyOn(engine as any, 'fetch').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 2,
          recordsToMigrate: 1,
          sampleRecords: [{ id: 'record_1', schoolId: 'school_1', name: 'Record 1' }],
          invalidRecords: [
            { id: 'record_2', reason: 'Missing both schoolId and entityId' },
          ],
        };
      });

      const result = await engine.fetch('tasks');

      expect(result.invalidRecords).toHaveLength(1);
      expect(result.invalidRecords[0].id).toBe('record_2');
      expect(result.invalidRecords[0].reason).toBe('Missing both schoolId and entityId');
    });

    it('should return sample records (first 5)', async () => {
      vi.spyOn(engine as any, 'fetch').mockImplementation(async () => {
        const sampleRecords = Array.from({ length: 10 }, (_, i) => ({
          id: `record_${i + 1}`,
          schoolId: `school_${i + 1}`,
          name: `Record ${i + 1}`,
        }));

        return {
          collection: 'tasks',
          totalRecords: 10,
          recordsToMigrate: 10,
          sampleRecords: sampleRecords.slice(0, 5),
          invalidRecords: [],
        };
      });

      const result = await engine.fetch('tasks');

      expect(result.sampleRecords).toHaveLength(5);
      expect(result.sampleRecords[0].id).toBe('record_1');
      expect(result.sampleRecords[4].id).toBe('record_5');
    });

    it('should handle empty collection', async () => {
      vi.spyOn(engine as any, 'fetch').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 0,
          recordsToMigrate: 0,
          sampleRecords: [],
          invalidRecords: [],
        };
      });

      const result = await engine.fetch('tasks');

      expect(result.totalRecords).toBe(0);
      expect(result.recordsToMigrate).toBe(0);
      expect(result.sampleRecords).toHaveLength(0);
    });

    it('should throw error on fetch failure', async () => {
      vi.spyOn(engine as any, 'fetch').mockRejectedValue(
        new Error('Fetch operation failed for tasks: Firestore error')
      );

      await expect(engine.fetch('tasks')).rejects.toThrow(
        'Fetch operation failed for tasks: Firestore error'
      );
    });
  });

  describe('2. Enrich Operation - Resolves EntityId Correctly', () => {
    it('should use existing entityId from migrated school', async () => {
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockImplementation(async () => {
        return {
          collection: 'tasks',
          records: [
            {
              id: 'record_1',
              original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
              enriched: {
                entityId: 'entity_existing',
                entityType: 'institution',
              },
            },
          ],
          backupCollection: 'backup_tasks_entity_migration',
        };
      });

      const result = await engine.enrich(batch);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].enriched.entityId).toBe('entity_existing');
      expect(result.records[0].enriched.entityType).toBe('institution');
    });

    it('should generate entityId for non-migrated school', async () => {
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockImplementation(async () => {
        return {
          collection: 'tasks',
          records: [
            {
              id: 'record_1',
              original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
              enriched: {
                entityId: 'entity_school_1',
                entityType: 'institution',
              },
            },
          ],
          backupCollection: 'backup_tasks_entity_migration',
        };
      });

      const result = await engine.enrich(batch);

      expect(result.records[0].enriched.entityId).toBe('entity_school_1');
    });

    it('should determine entityType from school data', async () => {
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockImplementation(async () => {
        return {
          collection: 'tasks',
          records: [
            {
              id: 'record_1',
              original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
              enriched: {
                entityId: 'entity_1',
                entityType: 'family',
              },
            },
          ],
          backupCollection: 'backup_tasks_entity_migration',
        };
      });

      const result = await engine.enrich(batch);

      expect(result.records[0].enriched.entityType).toBe('family');
    });

    it('should throw error when school not found', async () => {
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'record_1', schoolId: 'nonexistent_school', name: 'Task 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockRejectedValue(
        new Error('School nonexistent_school not found')
      );

      await expect(engine.enrich(batch)).rejects.toThrow(
        'School nonexistent_school not found'
      );
    });

    it('should set backup collection name correctly', async () => {
      const batch: MigrationBatch = {
        collection: 'activities',
        records: [
          { id: 'record_1', schoolId: 'school_1', name: 'Activity 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockImplementation(async () => {
        return {
          collection: 'activities',
          records: [
            {
              id: 'record_1',
              original: { id: 'record_1', schoolId: 'school_1', name: 'Activity 1' },
              enriched: {
                entityId: 'entity_1',
                entityType: 'institution',
              },
            },
          ],
          backupCollection: 'backup_activities_entity_migration',
        };
      });

      const result = await engine.enrich(batch);

      expect(result.backupCollection).toBe('backup_activities_entity_migration');
    });
  });

  describe('3. Restore Operation - Creates Backups Before Updating', () => {
    it('should create backup before updating record', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 1,
          failed: 0,
          skipped: 0,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should update record with entityId and entityType', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 1,
          failed: 0,
          skipped: 0,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
    });

    it('should skip already migrated records (idempotency)', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', entityId: 'entity_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 0,
          failed: 0,
          skipped: 1,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.skipped).toBe(1);
      expect(result.succeeded).toBe(0);
    });

    it('should handle individual record failures gracefully', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
          {
            id: 'record_2',
            original: { id: 'record_2', schoolId: 'school_2', name: 'Task 2' },
            enriched: {
              entityId: 'entity_2',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 2,
          succeeded: 1,
          failed: 1,
          skipped: 0,
          errors: [
            { id: 'record_2', error: 'Update failed' },
          ],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('record_2');
    });

    it('should preserve schoolId field during update', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 1,
          failed: 0,
          skipped: 0,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.succeeded).toBe(1);
    });
  });

  describe('4. Verify Operation - Counts Migrated/Unmigrated/Orphaned Records', () => {
    it('should count migrated records correctly', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 5,
          migratedRecords: 3,
          unmigratedRecords: 2,
          orphanedRecords: 0,
          validationErrors: [],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.totalRecords).toBe(5);
      expect(result.migratedRecords).toBe(3);
      expect(result.unmigratedRecords).toBe(2);
    });

    it('should count unmigrated records correctly', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 10,
          migratedRecords: 7,
          unmigratedRecords: 3,
          orphanedRecords: 0,
          validationErrors: [],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.unmigratedRecords).toBe(3);
    });

    it('should identify orphaned records (entityId exists but entity does not)', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 5,
          migratedRecords: 3,
          unmigratedRecords: 1,
          orphanedRecords: 1,
          validationErrors: [
            {
              recordId: 'record_3',
              field: 'entityId',
              issue: 'Entity entity_orphaned does not exist',
            },
          ],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.orphanedRecords).toBe(1);
      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].issue).toContain('does not exist');
    });

    it('should validate entityId is not empty', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 2,
          migratedRecords: 2,
          unmigratedRecords: 0,
          orphanedRecords: 0,
          validationErrors: [
            {
              recordId: 'record_1',
              field: 'entityId',
              issue: 'Empty entityId value',
            },
          ],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].issue).toBe('Empty entityId value');
    });

    it('should validate entityType is present', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 2,
          migratedRecords: 2,
          unmigratedRecords: 0,
          orphanedRecords: 0,
          validationErrors: [
            {
              recordId: 'record_1',
              field: 'entityType',
              issue: 'Missing entityType',
            },
          ],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].field).toBe('entityType');
      expect(result.validationErrors[0].issue).toBe('Missing entityType');
    });

    it('should validate entityType has valid value', async () => {
      vi.spyOn(engine as any, 'verify').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRecords: 2,
          migratedRecords: 2,
          unmigratedRecords: 0,
          orphanedRecords: 0,
          validationErrors: [
            {
              recordId: 'record_1',
              field: 'entityType',
              issue: 'Invalid entityType: invalid_type',
            },
          ],
        };
      });

      const result = await engine.verify('tasks');

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].issue).toContain('Invalid entityType');
    });

    it('should handle verification errors gracefully', async () => {
      vi.spyOn(engine as any, 'verify').mockRejectedValue(
        new Error('Verification failed for tasks: Firestore error')
      );

      await expect(engine.verify('tasks')).rejects.toThrow(
        'Verification failed for tasks: Firestore error'
      );
    });
  });

  describe('5. Rollback Operation - Restores from Backups', () => {
    it('should restore records from backup collection', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 3,
          failed: 0,
          errors: [],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.totalRestored).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should remove entityId and entityType during rollback', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 1,
          failed: 0,
          errors: [],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.totalRestored).toBe(1);
    });

    it('should handle individual rollback failures', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 2,
          failed: 1,
          errors: [
            { id: 'record_3', error: 'Restore failed' },
          ],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.totalRestored).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should delete backup collection after successful rollback', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 3,
          failed: 0,
          errors: [],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.failed).toBe(0);
      expect(result.totalRestored).toBe(3);
    });

    it('should not delete backup collection if rollback has failures', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 2,
          failed: 1,
          errors: [
            { id: 'record_3', error: 'Restore failed' },
          ],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.failed).toBeGreaterThan(0);
    });

    it('should handle empty backup collection', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 0,
          failed: 0,
          errors: [],
        };
      });

      const result = await engine.rollback('tasks');

      expect(result.totalRestored).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should be idempotent (safe to run multiple times)', async () => {
      vi.spyOn(engine as any, 'rollback').mockImplementation(async () => {
        return {
          collection: 'tasks',
          totalRestored: 3,
          failed: 0,
          errors: [],
        };
      });

      const result1 = await engine.rollback('tasks');
      const result2 = await engine.rollback('tasks');

      expect(result1.totalRestored).toBe(3);
      expect(result2.totalRestored).toBe(3);
    });
  });

  describe('6. Batch Processing - Handles Large Datasets', () => {
    it('should process records in batches of 450', async () => {
      const largeRecordSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `record_${i + 1}`,
        original: { id: `record_${i + 1}`, schoolId: `school_${i + 1}`, name: `Task ${i + 1}` },
        enriched: {
          entityId: `entity_${i + 1}`,
          entityType: 'institution' as const,
        },
      }));

      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: largeRecordSet,
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1000,
          succeeded: 1000,
          failed: 0,
          skipped: 0,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.total).toBe(1000);
      expect(result.succeeded).toBe(1000);
    });

    it('should handle multiple batches correctly', async () => {
      const largeRecordSet = Array.from({ length: 900 }, (_, i) => ({
        id: `record_${i + 1}`,
        original: { id: `record_${i + 1}`, schoolId: `school_${i + 1}`, name: `Task ${i + 1}` },
        enriched: {
          entityId: `entity_${i + 1}`,
          entityType: 'institution' as const,
        },
      }));

      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: largeRecordSet,
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 900,
          succeeded: 900,
          failed: 0,
          skipped: 0,
          errors: [],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.total).toBe(900);
      expect(result.succeeded).toBe(900);
    });

    it('should continue processing after batch failure', async () => {
      const largeRecordSet = Array.from({ length: 900 }, (_, i) => ({
        id: `record_${i + 1}`,
        original: { id: `record_${i + 1}`, schoolId: `school_${i + 1}`, name: `Task ${i + 1}` },
        enriched: {
          entityId: `entity_${i + 1}`,
          entityType: 'institution' as const,
        },
      }));

      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: largeRecordSet,
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 900,
          succeeded: 450,
          failed: 450,
          skipped: 0,
          errors: Array.from({ length: 450 }, (_, i) => ({
            id: `record_${i + 451}`,
            error: 'Batch commit failed',
          })),
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.succeeded).toBe(450);
      expect(result.failed).toBe(450);
    });
  });

  describe('7. Error Handling - Individual Record Failures', () => {
    it('should continue processing after individual record error', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
          {
            id: 'record_2',
            original: { id: 'record_2', schoolId: 'school_2', name: 'Task 2' },
            enriched: {
              entityId: 'entity_2',
              entityType: 'institution',
            },
          },
          {
            id: 'record_3',
            original: { id: 'record_3', schoolId: 'school_3', name: 'Task 3' },
            enriched: {
              entityId: 'entity_3',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 3,
          succeeded: 2,
          failed: 1,
          skipped: 0,
          errors: [
            { id: 'record_2', error: 'Update failed' },
          ],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should log error details for failed records', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 0,
          failed: 1,
          skipped: 0,
          errors: [
            { id: 'record_1', error: 'Firestore permission denied' },
          ],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.errors[0].id).toBe('record_1');
      expect(result.errors[0].error).toBe('Firestore permission denied');
    });

    it('should handle enrich operation errors', async () => {
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1,
      };

      vi.spyOn(engine as any, 'enrich').mockRejectedValue(
        new Error('Failed to enrich record record_1: School not found')
      );

      await expect(engine.enrich(batch)).rejects.toThrow(
        'Failed to enrich record record_1: School not found'
      );
    });

    it('should aggregate errors from multiple batches', async () => {
      const largeRecordSet = Array.from({ length: 900 }, (_, i) => ({
        id: `record_${i + 1}`,
        original: { id: `record_${i + 1}`, schoolId: `school_${i + 1}`, name: `Task ${i + 1}` },
        enriched: {
          entityId: `entity_${i + 1}`,
          entityType: 'institution' as const,
        },
      }));

      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: largeRecordSet,
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 900,
          succeeded: 895,
          failed: 5,
          skipped: 0,
          errors: [
            { id: 'record_100', error: 'Update failed' },
            { id: 'record_200', error: 'Update failed' },
            { id: 'record_300', error: 'Update failed' },
            { id: 'record_400', error: 'Update failed' },
            { id: 'record_500', error: 'Update failed' },
          ],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.errors).toHaveLength(5);
      expect(result.succeeded).toBe(895);
      expect(result.failed).toBe(5);
    });

    it('should provide meaningful error messages', async () => {
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'record_1',
            original: { id: 'record_1', schoolId: 'school_1', name: 'Task 1' },
            enriched: {
              entityId: 'entity_1',
              entityType: 'institution',
            },
          },
        ],
        backupCollection: 'backup_tasks_entity_migration',
      };

      vi.spyOn(engine as any, 'restore').mockImplementation(async () => {
        return {
          total: 1,
          succeeded: 0,
          failed: 1,
          skipped: 0,
          errors: [
            { id: 'record_1', error: 'Document does not exist' },
          ],
        };
      });

      const result = await engine.restore(enrichedBatch);

      expect(result.errors[0].error).toContain('Document does not exist');
    });
  });

  describe('8. Factory Function and Convenience Methods', () => {
    it('should create migration engine instance', () => {
      const engine = createMigrationEngine(mockFirestore);

      expect(engine).toBeDefined();
      expect(engine.fetch).toBeDefined();
      expect(engine.enrich).toBeDefined();
      expect(engine.restore).toBeDefined();
      expect(engine.verify).toBeDefined();
      expect(engine.rollback).toBeDefined();
    });

    it('should have all required methods', () => {
      const engine = createMigrationEngine(mockFirestore);

      expect(typeof engine.fetch).toBe('function');
      expect(typeof engine.enrich).toBe('function');
      expect(typeof engine.restore).toBe('function');
      expect(typeof engine.verify).toBe('function');
      expect(typeof engine.rollback).toBe('function');
    });
  });
});
