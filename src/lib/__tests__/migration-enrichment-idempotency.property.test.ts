/**
 * Property-Based Tests: Migration Enrichment Correctness and Idempotency
 * 
 * **Property 9: Migration Enrichment Correctness**
 * **Validates: Requirements 19.2, 19.3, 19.4**
 * 
 * For any record fetched for migration, if the associated school has
 * migrationStatus === 'migrated', the system should use the school's entityId field;
 * otherwise, it should generate a new entityId using the format entity_<entityId>.
 * 
 * **Property 13: Migration Idempotency**
 * **Validates: Requirements 19.10**
 * 
 * For any migration operation (enrich & restore), running the operation multiple
 * times on the same collection should produce the same final state, with
 * already-migrated records being skipped.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { createMigrationEngine } from '../migration-engine';
import type { MigrationBatch, EnrichedBatch, MigrationResult } from '../migration-types';
import type { Firestore } from 'firebase/firestore';

// Mock types
type MockSchoolData = {
  id: string;
  migrationStatus?: 'migrated' | 'not_started' | 'in_progress';
  entityId?: string;
  entityType?: 'institution' | 'family' | 'person';
  name: string;
};

type MockRecordData = {
  id: string;
  entityId: string;
  entityId?: string;
  entityType?: 'institution' | 'family' | 'person';
  title: string;
};

// In-memory storage
let mockSchools: Map<string, MockSchoolData>;
let mockCollections: Map<string, Map<string, MockRecordData>>;
let mockBackups: Map<string, Map<string, any>>;

// Mock firebase/firestore
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn((firestore: any, collectionName: string) => {
      return { _collectionName: collectionName };
    }),
    doc: vi.fn((firestore: any, collectionName: string, docId: string) => {
      return { _collectionName: collectionName, _docId: docId };
    }),
    getDoc: vi.fn(async (docRef: any) => {
      if (docRef._collectionName === 'schools') {
        const schoolData = mockSchools.get(docRef._docId);
        return {
          exists: (): boolean => !!schoolData,
          data: (): any => schoolData,
          id: docRef._docId,
        };
      }
      return { exists: (): boolean => false, data: (): any => undefined };
    }),
    getDocs: vi.fn(async (collectionRef: any) => {
      const collectionName = collectionRef._collectionName;
      const collectionData = mockCollections.get(collectionName) || new Map();
      
      const docs = Array.from(collectionData.values()).map((data) => ({
        id: data.id,
        data: (): any => data,
        ref: { _collectionName: collectionName, _docId: data.id },
      }));
      
      return {
        size: docs.length,
        forEach: (callback: (doc: any) => void) => docs.forEach(callback),
        docs,
      };
    }),
    setDoc: vi.fn(async (docRef: any, data: any) => {
      const collectionName = docRef._collectionName;
      const docId = docRef._docId;
      
      if (collectionName.startsWith('backup_')) {
        if (!mockBackups.has(collectionName)) {
          mockBackups.set(collectionName, new Map());
        }
        mockBackups.get(collectionName)!.set(docId, data);
      }
    }),
    writeBatch: vi.fn(() => {
      const operations: Array<{ type: string; ref: any; data: any }> = [];
      
      return {
        set: (ref: any, data: any) => {
          operations.push({ type: 'set', ref, data });
        },
        update: (ref: any, data: any) => {
          operations.push({ type: 'update', ref, data });
        },
        delete: (ref: any) => {
          operations.push({ type: 'delete', ref, data: null });
        },
        commit: async () => {
          for (const op of operations) {
            const collectionName = op.ref._collectionName;
            const docId = op.ref._docId;
            
            if (op.type === 'set') {
              if (collectionName.startsWith('backup_')) {
                if (!mockBackups.has(collectionName)) {
                  mockBackups.set(collectionName, new Map());
                }
                mockBackups.get(collectionName)!.set(docId, op.data);
              } else {
                if (!mockCollections.has(collectionName)) {
                  mockCollections.set(collectionName, new Map());
                }
                mockCollections.get(collectionName)!.set(docId, op.data);
              }
            } else if (op.type === 'update') {
              // Handle updates to main collections
              if (!mockCollections.has(collectionName)) {
                mockCollections.set(collectionName, new Map());
              }
              const collection = mockCollections.get(collectionName)!;
              if (collection.has(docId)) {
                const existing = collection.get(docId)!;
                collection.set(docId, { ...existing, ...op.data });
              }
            }
          }
        },
      };
    }),
    query: vi.fn((collectionRef: any) => collectionRef),
    where: vi.fn(() => ({})),
    deleteDoc: vi.fn(),
  };
});

describe('Property 9: Migration Enrichment Correctness', () => {
  beforeEach(() => {
    mockSchools = new Map();
    mockCollections = new Map();
    mockBackups = new Map();
    vi.clearAllMocks();
  });

  // Arbitraries for generating test data
  const migratedSchoolArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    migrationStatus: fc.constant('migrated' as const),
    entityId: fc.string({ minLength: 15, maxLength: 30 }).filter(id => !id.startsWith('entity_')),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    name: fc.string({ minLength: 5, maxLength: 50 }),
  });

  const nonMigratedSchoolArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }).filter(id => !['constructor', 'prototype', '__proto__'].includes(id)),
    migrationStatus: fc.constantFrom('not_started' as const, 'in_progress' as const, undefined),
    name: fc.string({ minLength: 5, maxLength: 50 }),
  });

  const unmigratedRecordArbitrary = (entityId: string) => fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.constant(entityId),
    title: fc.string({ minLength: 5, maxLength: 50 }),
  });

  it('should use existing entityId from migrated schools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 20 }),
        async (schools) => {
          // Setup: Create migrated schools
          schools.forEach(school => {
            mockSchools.set(school.id, school);
          });

          // Create unmigrated records for these schools
          const records = schools.map((school, idx) => ({
            id: `record_${idx}`,
            entityId: school.id,
            title: `Task ${idx}`,
          }));

          const batch: MigrationBatch = {
            collection: 'tasks',
            records,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Execute: Enrich the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch = await migrationEngine.enrich(batch);

          // Verify: Each enriched record should use the school's existing entityId
          expect(enrichedBatch.records.length).toBe(schools.length);
          
          enrichedBatch.records.forEach((enrichedRecord, idx) => {
            const school = schools[idx];
            expect(enrichedRecord.enriched.entityId).toBe(school.entityId);
            expect(enrichedRecord.enriched.entityType).toBe(school.entityType);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate entityId with entity_ prefix for non-migrated schools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(nonMigratedSchoolArbitrary, { minLength: 1, maxLength: 20 }),
        async (schools) => {
          // Setup: Create non-migrated schools
          schools.forEach(school => {
            mockSchools.set(school.id, school);
          });

          // Create unmigrated records for these schools
          const records = schools.map((school, idx) => ({
            id: `record_${idx}`,
            entityId: school.id,
            title: `Task ${idx}`,
          }));

          const batch: MigrationBatch = {
            collection: 'tasks',
            records,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Execute: Enrich the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch = await migrationEngine.enrich(batch);

          // Verify: Each enriched record should have generated entityId
          expect(enrichedBatch.records.length).toBe(schools.length);
          
          enrichedBatch.records.forEach((enrichedRecord, idx) => {
            const school = schools[idx];
            const expectedEntityId = `entity_${school.id}`;
            expect(enrichedRecord.enriched.entityId).toBe(expectedEntityId);
            expect(enrichedRecord.enriched.entityType).toBe('institution'); // Default
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed migrated and non-migrated schools correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          migrated: fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 10 }),
          nonMigrated: fc.array(nonMigratedSchoolArbitrary, { minLength: 1, maxLength: 10 }),
        }),
        async ({ migrated, nonMigrated }) => {
          // Setup: Create both types of schools
          migrated.forEach(school => mockSchools.set(school.id, school));
          nonMigrated.forEach(school => mockSchools.set(school.id, school));

          // Create records for all schools
          const allSchools = [...migrated, ...nonMigrated];
          const records = allSchools.map((school, idx) => ({
            id: `record_${idx}`,
            entityId: school.id,
            title: `Task ${idx}`,
          }));

          const batch: MigrationBatch = {
            collection: 'tasks',
            records,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Execute: Enrich the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch = await migrationEngine.enrich(batch);

          // Verify: Check each record has correct entityId based on migration status
          expect(enrichedBatch.records.length).toBe(allSchools.length);
          
          enrichedBatch.records.forEach((enrichedRecord, idx) => {
            const school = allSchools[idx];
            
            if ('entityId' in school && school.migrationStatus === 'migrated') {
              // Migrated school: should use existing entityId
              expect(enrichedRecord.enriched.entityId).toBe(school.entityId);
            } else {
              // Non-migrated school: should generate entityId
              expect(enrichedRecord.enriched.entityId).toBe(`entity_${school.id}`);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should continue processing after individual record failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validSchools: fc.array(migratedSchoolArbitrary, { minLength: 2, maxLength: 10 }),
          missingSchoolIds: fc.array(fc.string({ minLength: 10, maxLength: 20 }).filter(id => !['constructor', 'prototype', '__proto__'].includes(id)), { minLength: 1, maxLength: 5 }),
        }),
        async ({ validSchools, missingSchoolIds }) => {
          // Setup: Only add valid schools to mock
          validSchools.forEach(school => mockSchools.set(school.id, school));

          // Create records: some with valid schools, some with missing schools
          const validRecords = validSchools.map((school, idx) => ({
            id: `valid_${idx}`,
            entityId: school.id,
            title: `Valid Task ${idx}`,
          }));

          const invalidRecords = missingSchoolIds.map((entityId, idx) => ({
            id: `invalid_${idx}`,
            entityId,
            title: `Invalid Task ${idx}`,
          }));

          const allRecords = [...validRecords, ...invalidRecords];
          
          const batch: MigrationBatch = {
            collection: 'tasks',
            records: allRecords,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Execute: Enrich the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch = await migrationEngine.enrich(batch);

          // Verify: Valid records should be enriched, invalid ones skipped
          expect(enrichedBatch.records.length).toBe(validSchools.length);
          
          // All enriched records should be from valid schools
          enrichedBatch.records.forEach(enrichedRecord => {
            const matchingSchool = validSchools.find(s => s.id === enrichedRecord.original.entityId);
            expect(matchingSchool).toBeDefined();
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 13: Migration Idempotency', () => {
  beforeEach(() => {
    mockSchools = new Map();
    mockCollections = new Map();
    mockBackups = new Map();
    vi.clearAllMocks();
  });

  const migratedSchoolArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    migrationStatus: fc.constant('migrated' as const),
    entityId: fc.string({ minLength: 15, maxLength: 30 }),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    name: fc.string({ minLength: 5, maxLength: 50 }),
  });

  it('should skip already-migrated records in restore operation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 20 }),
        async (schools) => {
          // Setup: Create schools and records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          // Create records that are already migrated
          const records = schools.map((school, idx) => ({
            id: `record_${idx}`,
            entityId: school.entityId, // Already has entityId
            entityType: school.entityType,
            title: `Task ${idx}`,
          }));

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch (simulating enrich operation)
          const enrichedRecords = records.map(record => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: record.entityId!,
              entityType: record.entityType!,
            },
          }));

          const enrichedBatch: EnrichedBatch = {
            collection: collectionName,
            records: enrichedRecords,
            backupCollection: `backup_${collectionName}_entity_migration`,
          };

          // Execute: Restore the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          const result = await migrationEngine.restore(enrichedBatch);

          // Verify: All records should be skipped (already migrated)
          expect(result.skipped).toBe(schools.length);
          expect(result.succeeded).toBe(0);
          expect(result.failed).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce same result when run multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 10 }),
        async (schools) => {
          // Setup: Create schools
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          
          // Create unmigrated records
          const createUnmigratedRecords = () => {
            const records = schools.map((school, idx) => ({
              id: `record_${idx}`,
              entityId: school.id,
              title: `Task ${idx}`,
            }));
            return records;
          };

          // First migration run
          const records1 = createUnmigratedRecords();
          const collectionData1 = new Map<string, MockRecordData>();
          records1.forEach(record => collectionData1.set(record.id, record));
          mockCollections.set(collectionName, collectionData1);

          const batch1: MigrationBatch = {
            collection: collectionName,
            records: records1,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch1 = await migrationEngine.enrich(batch1);
          const result1 = await migrationEngine.restore(enrichedBatch1);

          // Capture state after first run
          const stateAfterFirstRun = new Map(mockCollections.get(collectionName));

          // Re-read records from collection for second run (they should now have entityId)
          const updatedRecords = Array.from(mockCollections.get(collectionName)!.values());
          const batch2: MigrationBatch = {
            collection: collectionName,
            records: updatedRecords,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Second migration run (on already-migrated data)
          const enrichedBatch2 = await migrationEngine.enrich(batch2);
          const result2 = await migrationEngine.restore(enrichedBatch2);

          // Verify: Second run should skip all records
          expect(result2.skipped).toBe(schools.length);
          expect(result2.succeeded).toBe(0);

          // Verify: Collection state should be unchanged
          const stateAfterSecondRun = mockCollections.get(collectionName);
          expect(stateAfterSecondRun?.size).toBe(stateAfterFirstRun.size);
          
          stateAfterFirstRun.forEach((record, id) => {
            const recordAfterSecond = stateAfterSecondRun?.get(id);
            expect(recordAfterSecond?.entityId).toBe(record.entityId);
            expect(recordAfterSecond?.entityType).toBe(record.entityType);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle partial migrations idempotently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          schools: fc.array(migratedSchoolArbitrary, { minLength: 5, maxLength: 15 }),
          migrateFirstN: fc.nat(),
        }).chain(({ schools, migrateFirstN }) => 
          fc.record({
            schools: fc.constant(schools),
            migrateFirstN: fc.constant(Math.min(migrateFirstN, schools.length - 1)),
          })
        ),
        async ({ schools, migrateFirstN }) => {
          if (schools.length === 0 || migrateFirstN === 0) return;

          // Setup: Create schools
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          // Create records: first N are already migrated, rest are not
          const records = schools.map((school, idx) => {
            const record: MockRecordData = {
              id: `record_${idx}`,
              entityId: school.id,
              title: `Task ${idx}`,
            };

            if (idx < migrateFirstN) {
              // Already migrated
              record.entityId = school.entityId;
              record.entityType = school.entityType;
            }

            return record;
          });

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create batch with all records
          const batch: MigrationBatch = {
            collection: collectionName,
            records,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Execute: Run migration
          const migrationEngine = createMigrationEngine({} as Firestore);
          const enrichedBatch = await migrationEngine.enrich(batch);
          const result = await migrationEngine.restore(enrichedBatch);

          // Verify: Already-migrated records should be skipped
          expect(result.skipped).toBe(migrateFirstN);
          expect(result.succeeded).toBe(schools.length - migrateFirstN);

          // Re-read records from collection for second run (they should now all have entityId)
          const updatedRecords = Array.from(mockCollections.get(collectionName)!.values());
          const batch2: MigrationBatch = {
            collection: collectionName,
            records: updatedRecords,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          // Run migration again
          const enrichedBatch2 = await migrationEngine.enrich(batch2);
          const result2 = await migrationEngine.restore(enrichedBatch2);

          // Verify: Second run should skip all records
          expect(result2.skipped).toBe(schools.length);
          expect(result2.succeeded).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain data consistency across multiple runs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 2, max: 5 }),
        async (schools, numRuns) => {
          // Setup: Create schools and unmigrated records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = schools.map((school, idx) => ({
            id: `record_${idx}`,
            entityId: school.id,
            title: `Task ${idx}`,
          }));

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          const batch: MigrationBatch = {
            collection: collectionName,
            records,
            batchSize: 450,
            totalBatches: 1,
            currentBatch: 1,
          };

          const migrationEngine = createMigrationEngine({} as Firestore);

          // Execute: Run migration multiple times
          const results: MigrationResult[] = [];
          
          for (let i = 0; i < numRuns; i++) {
            // Re-read records from collection for each run (except first)
            const currentRecords = i === 0 
              ? records 
              : Array.from(mockCollections.get(collectionName)?.values() || []);
            
            const currentBatch: MigrationBatch = {
              collection: collectionName,
              records: currentRecords,
              batchSize: 450,
              totalBatches: 1,
              currentBatch: 1,
            };
            
            const enrichedBatch = await migrationEngine.enrich(currentBatch);
            const result = await migrationEngine.restore(enrichedBatch);
            results.push(result);
          }

          // Verify: First run should succeed, subsequent runs should skip
          if (numRuns > 0) {
            expect(results[0].succeeded).toBe(schools.length);
            expect(results[0].skipped).toBe(0);

            for (let i = 1; i < numRuns; i++) {
              expect(results[i].succeeded).toBe(0);
              expect(results[i].skipped).toBe(schools.length);
            }
          }

          // Verify: Final state has all records migrated exactly once
          const finalCollection = mockCollections.get(collectionName);
          if (numRuns > 0 && finalCollection) {
            expect(finalCollection.size).toBe(schools.length);

            finalCollection.forEach((record, id) => {
              expect(record.entityId).toBeDefined();
              expect(record.entityType).toBeDefined();
              expect(record.entityId).toBeDefined(); // Preserved
            });
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
