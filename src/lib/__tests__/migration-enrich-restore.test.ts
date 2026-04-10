/**
 * Unit tests for Migration Engine - Enrich & Restore Operation
 * 
 * Tests for task 7: Implement enrich & restore operation
 * 
 * Requirements tested:
 * - 19.2: Resolve entityId by querying schools collection
 * - 19.3: Use school's entityId if migrationStatus === 'migrated'
 * - 19.4: Generate entityId using format entity_<entityId> if school doesn't have entityId
 * - 19.5: Create backup collection before updates
 * - 19.6: Update original record with entityId and entityType while preserving entityId
 * - 19.7: Process in batches of 450 records
 * - 19.8: Log errors for individual record failures
 * - 19.9: Continue processing remaining records after error
 * - 19.11: Track progress (percentage, records processed, current batch)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WriteBatch
} from 'firebase/firestore';
import { MigrationEngineImpl } from '../migration-engine';
import type { MigrationBatch, EnrichedBatch, MigrationProgress } from '../migration-types';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn()
}));

describe('Migration Engine - Enrich & Restore Operation', () => {
  let mockFirestore: Firestore;
  let engine: MigrationEngineImpl;
  let mockWriteBatch: WriteBatch;

  beforeEach(() => {
    mockFirestore = {} as Firestore;
    engine = new MigrationEngineImpl(mockFirestore);

    // Setup mock write batch
    mockWriteBatch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    } as unknown as WriteBatch;

    vi.mocked(writeBatch).mockReturnValue(mockWriteBatch);
  });

  describe('Task 7.1: Enrichment Logic', () => {
    it('should use school entityId when migrationStatus is migrated', async () => {
      // Requirement 19.3
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_1', entityId: 'school_1', title: 'Test Task' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock school with migrated status
      const mockSchoolSnapshot = {
        exists: () => true,
        data: () => ({
          id: 'school_1',
          migrationStatus: 'migrated',
          entityId: 'entity_abc123',
          entityType: 'institution'
        })
      } as unknown as DocumentSnapshot;

      vi.mocked(getDoc).mockResolvedValue(mockSchoolSnapshot);

      const result = await engine.enrich(batch);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].enriched.entityId).toBe('entity_abc123');
      expect(result.records[0].enriched.entityType).toBe('institution');
    });

    it('should generate entityId when school is not migrated', async () => {
      // Requirement 19.4
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_2', entityId: 'school_2', title: 'Test Task' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock school without migration
      const mockSchoolSnapshot = {
        exists: () => true,
        data: () => ({
          id: 'school_2',
          migrationStatus: 'not_started'
        })
      } as unknown as DocumentSnapshot;

      vi.mocked(getDoc).mockResolvedValue(mockSchoolSnapshot);

      const result = await engine.enrich(batch);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].enriched.entityId).toBe('entity_school_2');
      expect(result.records[0].enriched.entityType).toBe('institution');
    });

    it('should determine entityType from school data', async () => {
      // Requirement 19.2
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_3', entityId: 'school_3', title: 'Test Task' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock school with entityType
      const mockSchoolSnapshot = {
        exists: () => true,
        data: () => ({
          id: 'school_3',
          migrationStatus: 'migrated',
          entityId: 'entity_xyz789',
          entityType: 'family'
        })
      } as unknown as DocumentSnapshot;

      vi.mocked(getDoc).mockResolvedValue(mockSchoolSnapshot);

      const result = await engine.enrich(batch);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].enriched.entityType).toBe('family');
    });

    it('should default to institution when entityType is not specified', async () => {
      // Requirement 19.2
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_4', entityId: 'school_4', title: 'Test Task' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock school without entityType
      const mockSchoolSnapshot = {
        exists: () => true,
        data: () => ({
          id: 'school_4',
          migrationStatus: 'migrated',
          entityId: 'entity_def456'
        })
      } as unknown as DocumentSnapshot;

      vi.mocked(getDoc).mockResolvedValue(mockSchoolSnapshot);

      const result = await engine.enrich(batch);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].enriched.entityType).toBe('institution');
    });

    it('should log error and continue when school is not found', async () => {
      // Requirement 19.8, 19.9
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_5', entityId: 'school_missing', title: 'Test Task' },
          { id: 'task_6', entityId: 'school_6', title: 'Test Task 2' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock first school not found, second school exists
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => false
        } as unknown as DocumentSnapshot)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            id: 'school_6',
            migrationStatus: 'migrated',
            entityId: 'entity_6'
          })
        } as unknown as DocumentSnapshot);

      const result = await engine.enrich(batch);

      // Should only have 1 enriched record (the second one)
      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('task_6');

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to enrich record task_5')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should continue processing after error', async () => {
      // Requirement 19.9
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_7', entityId: 'school_7', title: 'Test Task' },
          { id: 'task_8', entityId: 'school_8', title: 'Test Task 2' },
          { id: 'task_9', entityId: 'school_9', title: 'Test Task 3' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      // Mock: first succeeds, second fails, third succeeds
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ id: 'school_7', migrationStatus: 'migrated', entityId: 'entity_7' })
        } as unknown as DocumentSnapshot)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ id: 'school_9', migrationStatus: 'migrated', entityId: 'entity_9' })
        } as unknown as DocumentSnapshot);

      const result = await engine.enrich(batch);

      // Should have 2 enriched records (first and third)
      expect(result.records).toHaveLength(2);
      expect(result.records[0].id).toBe('task_7');
      expect(result.records[1].id).toBe('task_9');

      // Should have logged error for second record
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to enrich record task_8'),
        expect.any(String)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should track progress during enrichment', async () => {
      // Requirement 19.11
      const batch: MigrationBatch = {
        collection: 'tasks',
        records: [
          { id: 'task_10', entityId: 'school_10', title: 'Test Task 1' },
          { id: 'task_11', entityId: 'school_11', title: 'Test Task 2' },
          { id: 'task_12', entityId: 'school_12', title: 'Test Task 3' }
        ],
        batchSize: 450,
        totalBatches: 1,
        currentBatch: 1
      };

      const progressUpdates: MigrationProgress[] = [];
      const onProgress = (progress: MigrationProgress) => {
        progressUpdates.push(progress);
      };

      // Mock all schools exist
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ migrationStatus: 'migrated', entityId: 'entity_test' })
      } as unknown as DocumentSnapshot);

      await engine.enrich(batch, onProgress);

      // Should have 3 progress updates (one per record)
      expect(progressUpdates).toHaveLength(3);

      // Check first progress update
      expect(progressUpdates[0]).toMatchObject({
        collection: 'tasks',
        phase: 'enrich',
        percentage: 33,
        recordsProcessed: 1,
        totalRecords: 3,
        currentBatch: 1,
        totalBatches: 1
      });

      // Check last progress update
      expect(progressUpdates[2]).toMatchObject({
        collection: 'tasks',
        phase: 'enrich',
        percentage: 100,
        recordsProcessed: 3,
        totalRecords: 3,
        currentBatch: 1,
        totalBatches: 1
      });
    });
  });

  describe('Task 7.2: Backup and Restore Logic', () => {
    it('should create backup before updating records', async () => {
      // Requirement 19.5
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_13',
            original: { id: 'task_13', entityId: 'school_13', title: 'Test Task' },
            enriched: { entityId: 'entity_13', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      await engine.restore(enrichedBatch);

      // Should have called set for backup
      const setCalls = vi.mocked(mockWriteBatch.set).mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      
      // Check the backup data (second argument)
      const backupData = setCalls[0][1];
      expect(backupData).toMatchObject({
        id: 'task_13',
        entityId: 'school_13',
        title: 'Test Task'
      });
      expect(backupData).toHaveProperty('backedUpAt');
    });

    it('should update original record with entityId and entityType', async () => {
      // Requirement 19.6
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_14',
            original: { id: 'task_14', entityId: 'school_14', title: 'Test Task' },
            enriched: { entityId: 'entity_14', entityType: 'family' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      await engine.restore(enrichedBatch);

      // Should have called update with entityId and entityType
      const updateCalls = vi.mocked(mockWriteBatch.update).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      // Check the update data (second argument)
      const updateData = updateCalls[0][1];
      expect(updateData).toMatchObject({
        entityId: 'entity_14',
        entityType: 'family'
      });
      expect(updateData).toHaveProperty('updatedAt');
    });

    it('should preserve original entityId field', async () => {
      // Requirement 19.6 - dual-write
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_15',
            original: { id: 'task_15', entityId: 'school_15', title: 'Test Task' },
            enriched: { entityId: 'entity_15', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      await engine.restore(enrichedBatch);

      // Update should only include entityId and entityType, not remove entityId
      const updateCalls = vi.mocked(mockWriteBatch.update).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      // Check the update data (second argument) - should NOT contain entityId
      const updateData = updateCalls[0][1];
      expect(updateData).not.toHaveProperty('entityId');
      expect(updateData).toHaveProperty('entityId');
      expect(updateData).toHaveProperty('entityType');
    });

    it('should skip already migrated records', async () => {
      // Requirement 19.10 - idempotency
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_16',
            original: { 
              id: 'task_16', 
              entityId: 'entity_16', // Already has entityId
              title: 'Test Task' 
            },
            enriched: { entityId: 'entity_16', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      const result = await engine.restore(enrichedBatch);

      expect(result.skipped).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should process in batches of 450 records', async () => {
      // Requirement 19.7
      const records = Array.from({ length: 900 }, (_, i) => ({
        id: `task_${i}`,
        original: { id: `task_${i}`, entityId: `school_${i}`, title: `Task ${i}` },
        enriched: { entityId: `entity_${i}`, entityType: 'institution' as const }
      }));

      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records,
        backupCollection: 'backup_tasks_entity_migration'
      };

      await engine.restore(enrichedBatch);

      // Should have committed 2 batches (900 / 450 = 2)
      expect(mockWriteBatch.commit).toHaveBeenCalledTimes(2);
    });

    it('should continue processing after individual record error', async () => {
      // Requirement 19.9
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_17',
            original: { id: 'task_17', entityId: 'school_17', title: 'Test Task 1' },
            enriched: { entityId: 'entity_17', entityType: 'institution' }
          },
          {
            id: 'task_18',
            original: { id: 'task_18', entityId: 'school_18', title: 'Test Task 2' },
            enriched: { entityId: 'entity_18', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      // Mock update to throw error on first call
      vi.mocked(mockWriteBatch.update)
        .mockImplementationOnce(() => {
          throw new Error('Update failed');
        });

      const result = await engine.restore(enrichedBatch);

      // Should have 1 failed and 1 succeeded
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('task_17');
    });

    it('should track progress during restore', async () => {
      // Requirement 19.11
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_19',
            original: { id: 'task_19', entityId: 'school_19', title: 'Test Task 1' },
            enriched: { entityId: 'entity_19', entityType: 'institution' }
          },
          {
            id: 'task_20',
            original: { id: 'task_20', entityId: 'school_20', title: 'Test Task 2' },
            enriched: { entityId: 'entity_20', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      const progressUpdates: MigrationProgress[] = [];
      const onProgress = (progress: MigrationProgress) => {
        progressUpdates.push(progress);
      };

      await engine.restore(enrichedBatch, onProgress);

      // Should have at least 1 progress update (after batch commit)
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Check progress update structure
      expect(progressUpdates[0]).toMatchObject({
        collection: 'tasks',
        phase: 'restore',
        percentage: 100,
        recordsProcessed: 2,
        totalRecords: 2,
        currentBatch: 1,
        totalBatches: 1
      });
    });
  });

  describe('Task 7.3: Error Handling and Progress Tracking', () => {
    it('should return summary with total, succeeded, failed, skipped', async () => {
      // Requirement 19.11
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_21',
            original: { id: 'task_21', entityId: 'school_21', title: 'Test Task 1' },
            enriched: { entityId: 'entity_21', entityType: 'institution' }
          },
          {
            id: 'task_22',
            original: { 
              id: 'task_22', 
              entityId: 'entity_22', // Already migrated
              title: 'Test Task 2' 
            },
            enriched: { entityId: 'entity_22', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      const result = await engine.restore(enrichedBatch);

      expect(result).toMatchObject({
        total: 2,
        succeeded: 1,
        failed: 0,
        skipped: 1,
        errors: []
      });
    });

    it('should include error details in summary', async () => {
      // Requirement 19.8
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_23',
            original: { id: 'task_23', entityId: 'school_23', title: 'Test Task' },
            enriched: { entityId: 'entity_23', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      // Mock batch commit to fail
      vi.mocked(mockWriteBatch.commit).mockRejectedValueOnce(new Error('Firestore error'));

      const result = await engine.restore(enrichedBatch);

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        id: 'task_23',
        error: expect.stringContaining('Batch commit failed')
      });
    });

    it('should handle batch commit failure gracefully', async () => {
      // Requirement 19.9
      const enrichedBatch: EnrichedBatch = {
        collection: 'tasks',
        records: [
          {
            id: 'task_24',
            original: { id: 'task_24', entityId: 'school_24', title: 'Test Task 1' },
            enriched: { entityId: 'entity_24', entityType: 'institution' }
          },
          {
            id: 'task_25',
            original: { id: 'task_25', entityId: 'school_25', title: 'Test Task 2' },
            enriched: { entityId: 'entity_25', entityType: 'institution' }
          }
        ],
        backupCollection: 'backup_tasks_entity_migration'
      };

      // Mock batch commit to fail
      vi.mocked(mockWriteBatch.commit).mockRejectedValueOnce(new Error('Firestore error'));

      const result = await engine.restore(enrichedBatch);

      // All records in the failed batch should be marked as failed
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });
});
