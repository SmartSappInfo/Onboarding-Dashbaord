/**
 * Property-Based Test: Migration Fetch Accuracy
 * 
 * **Property 8: Migration Fetch Accuracy**
 * **Validates: Requirements 18.1, 19.1**
 * 
 * For any feature collection, the fetch operation should return exactly those
 * records that have a entityId field but no entityId field, identifying them
 * as unmigrated.
 * 
 * This test uses fast-check to generate random collection states with various
 * combinations of records (migrated, unmigrated, invalid) and verifies that
 * the fetch operation correctly identifies only the unmigrated records.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { createMigrationEngine } from '../migration-engine';
import type { FetchResult } from '../migration-types';
import type { Firestore } from 'firebase/firestore';

// Mock Firestore types
type MockDocumentData = {
  id: string;
  entityId?: string;
  entityId?: string;
  [key: string]: any;
};

// In-memory storage for testing
let mockCollections: Map<string, Map<string, MockDocumentData>>;

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn((firestore: any, collectionName: string) => {
      return { _collectionName: collectionName };
    }),
    getDocs: vi.fn(async (collectionRef: any) => {
      const collectionName = collectionRef._collectionName;
      const collectionData = mockCollections.get(collectionName) || new Map();
      
      const docs = Array.from(collectionData.values()).map((data) => ({
        id: data.id,
        data: () => data,
      }));
      
      return {
        size: docs.length,
        forEach: (callback: (doc: any) => void) => {
          docs.forEach(callback);
        },
        docs,
      };
    }),
    query: vi.fn((collectionRef: any, ...constraints: any[]) => collectionRef),
    where: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    writeBatch: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

describe('Property 8: Migration Fetch Accuracy', () => {
  beforeEach(() => {
    mockCollections = new Map();
    vi.clearAllMocks();
  });

  /**
   * Arbitrary for generating a record with entityId but no entityId (unmigrated)
   */
  const unmigratedRecordArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 10, maxLength: 20 }),
    // entityId is intentionally omitted
    title: fc.string(),
    status: fc.constantFrom('active', 'archived', 'pending'),
  });

  /**
   * Arbitrary for generating a record with both entityId and entityId (migrated)
   */
  const migratedRecordArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 15, maxLength: 30 }),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    title: fc.string(),
    status: fc.constantFrom('active', 'archived', 'pending'),
  });

  /**
   * Arbitrary for generating a record with neither entityId nor entityId (invalid)
   */
  const invalidRecordArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    // Both entityId and entityId are intentionally omitted
    title: fc.string(),
    status: fc.constantFrom('active', 'archived', 'pending'),
  });

  /**
   * Arbitrary for generating a record with only entityId (new record, no migration needed)
   */
  const entityOnlyRecordArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 15, maxLength: 30 }),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    title: fc.string(),
    status: fc.constantFrom('active', 'archived', 'pending'),
  });

  it('should return exactly records with entityId but no entityId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          unmigrated: fc.array(unmigratedRecordArbitrary, { minLength: 0, maxLength: 20 }),
          migrated: fc.array(migratedRecordArbitrary, { minLength: 0, maxLength: 20 }),
          invalid: fc.array(invalidRecordArbitrary, { minLength: 0, maxLength: 10 }),
          entityOnly: fc.array(entityOnlyRecordArbitrary, { minLength: 0, maxLength: 10 }),
        }),
        async ({ unmigrated, migrated, invalid, entityOnly }) => {
          // Setup: Create a collection with mixed record types
          const collectionName = 'test_tasks';
          const collectionData = new Map<string, MockDocumentData>();

          // Add unmigrated records (should be returned by fetch)
          unmigrated.forEach((record) => {
            collectionData.set(record.id, record);
          });

          // Add migrated records (should NOT be returned by fetch)
          migrated.forEach((record) => {
            collectionData.set(record.id, record);
          });

          // Add invalid records (should be flagged as invalid)
          invalid.forEach((record) => {
            collectionData.set(record.id, record);
          });

          // Add entity-only records (should NOT be returned by fetch)
          entityOnly.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run fetch operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: FetchResult = await migrationEngine.fetch(collectionName);

          // Verify: Check that fetch returns exactly the unmigrated records
          expect(result.collection).toBe(collectionName);
          expect(result.totalRecords).toBe(collectionData.size);
          expect(result.recordsToMigrate).toBe(unmigrated.length);
          expect(result.invalidRecords.length).toBe(invalid.length);

          // Verify that all unmigrated record IDs are in the sample or would be in full results
          const unmigratedIds = new Set(unmigrated.map((r) => r.id));
          const sampleIds = new Set(result.sampleRecords.map((r: any) => r.id));
          
          // Sample should only contain unmigrated records
          result.sampleRecords.forEach((record: any) => {
            expect(unmigratedIds.has(record.id)).toBe(true);
            expect(record.entityId).toBeDefined();
            expect(record.entityId).toBeUndefined();
          });

          // All invalid record IDs should be flagged
          const invalidIds = new Set(invalid.map((r) => r.id));
          result.invalidRecords.forEach((invalidRecord) => {
            expect(invalidIds.has(invalidRecord.id)).toBe(true);
            expect(invalidRecord.reason).toBe('Missing both entityId and entityId');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not return records that already have entityId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedRecordArbitrary, { minLength: 1, maxLength: 50 }),
        async (migratedRecords) => {
          // Setup: Create a collection with only migrated records
          const collectionName = 'test_activities';
          const collectionData = new Map<string, MockDocumentData>();

          migratedRecords.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run fetch operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: FetchResult = await migrationEngine.fetch(collectionName);

          // Verify: No records should need migration
          expect(result.recordsToMigrate).toBe(0);
          expect(result.sampleRecords.length).toBe(0);
          expect(result.totalRecords).toBe(migratedRecords.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty collections correctly', async () => {
    // Setup: Create an empty collection
    const collectionName = 'test_empty';
    mockCollections.set(collectionName, new Map());

    // Execute: Run fetch operation
    const migrationEngine = createMigrationEngine({} as any);
    const result: FetchResult = await migrationEngine.fetch(collectionName);

    // Verify: All counts should be zero
    expect(result.totalRecords).toBe(0);
    expect(result.recordsToMigrate).toBe(0);
    expect(result.sampleRecords.length).toBe(0);
    expect(result.invalidRecords.length).toBe(0);
  });

  it('should limit sample records to first 5', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(unmigratedRecordArbitrary, { minLength: 10, maxLength: 100 }),
        async (unmigratedRecords) => {
          // Setup: Create a collection with many unmigrated records
          const collectionName = 'test_forms';
          const collectionData = new Map<string, MockDocumentData>();

          unmigratedRecords.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run fetch operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: FetchResult = await migrationEngine.fetch(collectionName);

          // Verify: Sample should be limited to 5 records
          expect(result.sampleRecords.length).toBeLessThanOrEqual(5);
          expect(result.recordsToMigrate).toBe(unmigratedRecords.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly identify records with only entityId as not needing migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          unmigrated: fc.array(unmigratedRecordArbitrary, { minLength: 1, maxLength: 10 }),
          entityOnly: fc.array(entityOnlyRecordArbitrary, { minLength: 1, maxLength: 10 }),
        }),
        async ({ unmigrated, entityOnly }) => {
          // Setup: Mix of unmigrated and entity-only records
          const collectionName = 'test_mixed';
          const collectionData = new Map<string, MockDocumentData>();

          unmigrated.forEach((record) => {
            collectionData.set(record.id, record);
          });

          entityOnly.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run fetch operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: FetchResult = await migrationEngine.fetch(collectionName);

          // Verify: Only unmigrated records should be counted
          expect(result.recordsToMigrate).toBe(unmigrated.length);
          
          // Verify that entity-only records are not in the results
          const entityOnlyIds = new Set(entityOnly.map((r) => r.id));
          result.sampleRecords.forEach((record: any) => {
            expect(entityOnlyIds.has(record.id)).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain accuracy across different collection sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 1000 }).chain((size) =>
          fc.record({
            size: fc.constant(size),
            unmigratedRatio: fc.double({ min: 0, max: 1 }),
          })
        ),
        async ({ size, unmigratedRatio }) => {
          // Setup: Generate collection with specific size and unmigrated ratio
          const collectionName = 'test_scalability';
          const collectionData = new Map<string, MockDocumentData>();
          
          const numUnmigrated = Math.floor(size * unmigratedRatio);
          const numMigrated = size - numUnmigrated;

          // Add unmigrated records
          for (let i = 0; i < numUnmigrated; i++) {
            const record: MockDocumentData = {
              id: `unmigrated_${i}`,
              entityId: `school_${i}`,
              title: `Task ${i}`,
              status: 'active',
            };
            collectionData.set(record.id, record);
          }

          // Add migrated records
          for (let i = 0; i < numMigrated; i++) {
            const record: MockDocumentData = {
              id: `migrated_${i}`,
              entityId: `entity_${i}`,
              entityType: 'institution',
              title: `Task ${i}`,
              status: 'active',
            };
            collectionData.set(record.id, record);
          }

          mockCollections.set(collectionName, collectionData);

          // Execute: Run fetch operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: FetchResult = await migrationEngine.fetch(collectionName);

          // Verify: Counts should match expected values
          expect(result.totalRecords).toBe(size);
          expect(result.recordsToMigrate).toBe(numUnmigrated);
          expect(result.sampleRecords.length).toBeLessThanOrEqual(Math.min(5, numUnmigrated));
        }
      ),
      { numRuns: 50 }
    );
  });
});
