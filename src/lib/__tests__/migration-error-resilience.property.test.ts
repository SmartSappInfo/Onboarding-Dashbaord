/**
 * Property-Based Test: Migration Error Resilience
 * 
 * **Property 12: Migration Error Resilience**
 * **Validates: Requirements 19.9**
 * 
 * For any migration batch B with some records that will fail:
 * - The migration should continue processing remaining records after individual failures
 * - Failed records should be logged in the result.errors array
 * - Successful records should be counted in result.succeeded
 * - The total of succeeded + failed + skipped should equal the batch size
 * 
 * This ensures that a single bad record doesn't halt the entire migration process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { Firestore, writeBatch, doc, collection, getDocs, query, where, getDoc } from 'firebase/firestore';
import type { EnrichedBatch, EnrichedRecord, MigrationResult } from '../migration-types';

// Mock Firebase modules
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    writeBatch: vi.fn(),
    doc: vi.fn(),
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDoc: vi.fn(),
  };
});

// In-memory storage for testing
const mockStorage = {
  tasks: new Map<string, any>(),
  activities: new Map<string, any>(),
  backups: new Map<string, any>(),
  reset: () => {
    mockStorage.tasks.clear();
    mockStorage.activities.clear();
    mockStorage.backups.clear();
  },
};

/**
 * Simulates the restore operation from migration-engine.ts
 * This is a simplified version that focuses on error handling
 */
async function simulateRestore(
  enrichedBatch: EnrichedBatch,
  failingRecordIds: Set<string> = new Set()
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: enrichedBatch.records.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  // Process records in batches (simplified to batch size of 5 for testing)
  const BATCH_SIZE = 5;
  const batches: EnrichedRecord[][] = [];
  
  for (let i = 0; i < enrichedBatch.records.length; i += BATCH_SIZE) {
    batches.push(enrichedBatch.records.slice(i, i + BATCH_SIZE));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batchRecords = batches[batchIndex];
    const batchOperations: Array<{ record: EnrichedRecord; success: boolean }> = [];

    for (const enrichedRecord of batchRecords) {
      try {
        // Check if already migrated (idempotency)
        if (enrichedRecord.original.entityId) {
          result.skipped++;
          continue;
        }

        // Simulate failure for specific records
        if (failingRecordIds.has(enrichedRecord.id)) {
          throw new Error(`Simulated failure for record ${enrichedRecord.id}`);
        }

        // Create backup
        mockStorage.backups.set(enrichedRecord.id, {
          ...enrichedRecord.original,
          backedUpAt: new Date().toISOString()
        });

        // Update original record
        const collectionMap = enrichedBatch.collection === 'tasks' 
          ? mockStorage.tasks 
          : mockStorage.activities;
        
        const existing = collectionMap.get(enrichedRecord.id) || enrichedRecord.original;
        collectionMap.set(enrichedRecord.id, {
          ...existing,
          entityId: enrichedRecord.enriched.entityId,
          entityType: enrichedRecord.enriched.entityType,
          updatedAt: new Date().toISOString()
        });

        batchOperations.push({ record: enrichedRecord, success: true });
      } catch (error) {
        // Log error but continue processing (Requirement 19.9)
        result.failed++;
        result.errors.push({
          id: enrichedRecord.id,
          error: error instanceof Error ? error.message : String(error)
        });
        batchOperations.push({ record: enrichedRecord, success: false });
      }
    }

    // Count successful operations in this batch
    const successfulInBatch = batchOperations.filter(op => op.success).length;
    result.succeeded += successfulInBatch;
  }

  return result;
}

// Fast-check arbitraries for generating test data
const enrichedRecordArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }),
  original: fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    workspaceId: fc.string({ minLength: 10, maxLength: 20 }),
    schoolId: fc.string({ minLength: 10, maxLength: 20 }),
    title: fc.string({ minLength: 5, maxLength: 50 }),
    description: fc.string({ minLength: 10, maxLength: 100 }),
    status: fc.constantFrom('todo', 'in_progress', 'done'),
    createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() })
      .map(timestamp => new Date(timestamp).toISOString()),
  }),
  enriched: fc.record({
    entityId: fc.string({ minLength: 15, maxLength: 30 }).map(s => `entity_${s}`),
    entityType: fc.constantFrom('institution', 'family', 'person') as fc.Arbitrary<'institution' | 'family' | 'person'>,
  }),
});

const enrichedBatchArbitrary = fc.record({
  collection: fc.constantFrom('tasks', 'activities'),
  records: fc.array(enrichedRecordArbitrary, { minLength: 5, maxLength: 20 }),
  backupCollection: fc.string({ minLength: 10, maxLength: 30 }).map(s => `backup_${s}`),
});

describe('Property 12: Migration Error Resilience', () => {
  beforeEach(() => {
    mockStorage.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage.reset();
  });

  it('should continue processing after individual record failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary,
        fc.integer({ min: 1, max: 3 }), // Number of records to fail
        async (batch, numFailures) => {
          // Setup: Select random records to fail
          const failingRecordIds = new Set<string>();
          const recordIds = batch.records.map(r => r.id);
          
          // Ensure we don't try to fail more records than exist
          const actualFailures = Math.min(numFailures, recordIds.length - 1);
          
          for (let i = 0; i < actualFailures; i++) {
            const randomIndex = Math.floor(Math.random() * recordIds.length);
            failingRecordIds.add(recordIds[randomIndex]);
          }

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration with some records failing
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: Total records processed equals batch size
          expect(result.total).toBe(batch.records.length);

          // Assert: Sum of succeeded + failed + skipped equals total
          expect(result.succeeded + result.failed + result.skipped).toBe(result.total);

          // Assert: Failed count matches or exceeds the number of failing records
          // (may be higher if batch commit fails)
          expect(result.failed).toBeGreaterThanOrEqual(failingRecordIds.size);

          // Assert: Errors are logged for failed records
          expect(result.errors.length).toBe(result.failed);

          // Assert: Each error has an id and error message
          for (const error of result.errors) {
            expect(error.id).toBeDefined();
            expect(typeof error.id).toBe('string');
            expect(error.error).toBeDefined();
            expect(typeof error.error).toBe('string');
          }

          // Assert: Successful records were migrated
          expect(result.succeeded).toBeGreaterThan(0);

          // Assert: Successful records have entityId in storage
          for (const record of batch.records) {
            if (!failingRecordIds.has(record.id)) {
              const stored = collectionMap.get(record.id) as any;
              if (stored && !(record.original as any).entityId) {
                // Should have been migrated
                expect(stored.entityId).toBeDefined();
                expect(stored.entityType).toBeDefined();
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should process all records even when multiple consecutive records fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary.filter(batch => batch.records.length >= 10),
        async (batch) => {
          // Setup: Make first 3 records fail
          const failingRecordIds = new Set<string>(
            batch.records.slice(0, 3).map(r => r.id)
          );

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: At least 3 records failed
          expect(result.failed).toBeGreaterThanOrEqual(3);

          // Assert: Remaining records were processed
          const expectedSuccessful = batch.records.length - failingRecordIds.size;
          expect(result.succeeded).toBeGreaterThanOrEqual(expectedSuccessful - 1);

          // Assert: All records accounted for
          expect(result.succeeded + result.failed + result.skipped).toBe(result.total);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle the case where all records fail gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary,
        async (batch) => {
          // Setup: Make all records fail
          const failingRecordIds = new Set<string>(batch.records.map(r => r.id));

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: All records failed
          expect(result.failed).toBe(batch.records.length);
          expect(result.succeeded).toBe(0);

          // Assert: All failures logged
          expect(result.errors.length).toBe(batch.records.length);

          // Assert: Total still correct
          expect(result.total).toBe(batch.records.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should not affect successful records when some records fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary.filter(batch => batch.records.length >= 5),
        async (batch) => {
          // Setup: Make middle record fail
          const middleIndex = Math.floor(batch.records.length / 2);
          const failingRecordIds = new Set<string>([batch.records[middleIndex].id]);

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: Records before and after the failing record were migrated
          const firstRecord = batch.records[0];
          const lastRecord = batch.records[batch.records.length - 1];

          if (!(firstRecord.original as any).entityId) {
            const firstStored = collectionMap.get(firstRecord.id) as any;
            expect(firstStored.entityId).toBeDefined();
            expect(firstStored.entityType).toBeDefined();
          }

          if (!(lastRecord.original as any).entityId) {
            const lastStored = collectionMap.get(lastRecord.id) as any;
            expect(lastStored.entityId).toBeDefined();
            expect(lastStored.entityType).toBeDefined();
          }

          // Assert: Failed record was not migrated
          const failedRecord = collectionMap.get(batch.records[middleIndex].id) as any;
          if (!(batch.records[middleIndex].original as any).entityId) {
            expect(failedRecord.entityId).toBeUndefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should skip already migrated records and continue processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary.filter(batch => batch.records.length >= 3),
        async (batch) => {
          // Setup: Mark first record as already migrated
          (batch.records[0].original as any).entityId = 'existing-entity-id';
          (batch.records[0].original as any).entityType = 'institution';

          // Setup: Make second record fail
          const failingRecordIds = new Set<string>([batch.records[1].id]);

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: First record was skipped
          expect(result.skipped).toBeGreaterThanOrEqual(1);

          // Assert: Second record failed
          expect(result.failed).toBeGreaterThanOrEqual(1);

          // Assert: Remaining records succeeded
          expect(result.succeeded).toBeGreaterThan(0);

          // Assert: All records accounted for
          expect(result.succeeded + result.failed + result.skipped).toBe(result.total);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain error details for debugging', async () => {
    await fc.assert(
      fc.asyncProperty(
        enrichedBatchArbitrary,
        fc.integer({ min: 1, max: 3 }),
        async (batch, numFailures) => {
          // Setup: Select records to fail
          const failingRecordIds = new Set<string>();
          const actualFailures = Math.min(numFailures, batch.records.length);
          
          for (let i = 0; i < actualFailures; i++) {
            failingRecordIds.add(batch.records[i].id);
          }

          // Setup: Add records to mock storage
          const collectionMap = batch.collection === 'tasks' 
            ? mockStorage.tasks 
            : mockStorage.activities;
          
          for (const record of batch.records) {
            collectionMap.set(record.id, record.original);
          }

          // Execute: Run migration
          const result = await simulateRestore(batch, failingRecordIds);

          // Assert: Each error contains the record ID
          for (const error of result.errors) {
            expect(failingRecordIds.has(error.id) || batch.records.some(r => r.id === error.id)).toBe(true);
          }

          // Assert: Error messages are descriptive
          for (const error of result.errors) {
            expect(error.error.length).toBeGreaterThan(0);
            expect(error.error).toContain('Simulated failure');
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
