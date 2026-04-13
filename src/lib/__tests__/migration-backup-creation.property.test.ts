/**
 * Property-Based Test: Migration Backup Creation
 * 
 * **Property 10: Migration Backup Creation**
 * **Validates: Requirements 19.5**
 * 
 * For any record being migrated, the system should create a backup copy in the
 * backup_<collection>_entity_migration collection before applying any updates.
 * 
 * This property ensures that:
 * 1. Every record update is preceded by a backup creation
 * 2. Backups contain the complete original record data
 * 3. Backups include a backedUpAt timestamp
 * 4. No updates occur without corresponding backups
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { createMigrationEngine } from '../migration-engine';
import type { EnrichedBatch, MigrationResult } from '../migration-types';
import type { Firestore } from 'firebase/firestore';

// Mock types
type MockSchoolData = {
  id: string;
  migrationStatus: 'migrated';
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  name: string;
};

type MockRecordData = {
  id: string;
  entityId?: string;
  entityType?: 'institution' | 'family' | 'person';
  title: string;
  description?: string;
  status?: string;
  createdAt?: string;
};

type BackupRecord = MockRecordData & {
  backedUpAt: string;
};

// In-memory storage
let mockSchools: Map<string, MockSchoolData>;
let mockCollections: Map<string, Map<string, MockRecordData>>;
let mockBackups: Map<string, Map<string, BackupRecord>>;
let backupOperations: Array<{ collectionName: string; recordId: string; timestamp: number }>;
let updateOperations: Array<{ collectionName: string; recordId: string; timestamp: number }>;

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
      
      // Check main collections
      const collectionData = mockCollections.get(docRef._collectionName);
      if (collectionData) {
        const recordData = collectionData.get(docRef._docId);
        return {
          exists: (): boolean => !!recordData,
          data: (): any => recordData,
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
        data: () => data,
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
        // Record backup operation with timestamp
        backupOperations.push({
          collectionName,
          recordId: docId,
          timestamp: Date.now(),
        });
        
        if (!mockBackups.has(collectionName)) {
          mockBackups.set(collectionName, new Map());
        }
        mockBackups.get(collectionName)!.set(docId, data as BackupRecord);
      }
    }),
    writeBatch: vi.fn(() => {
      const operations: Array<{ type: string; ref: any; data: any; timestamp: number }> = [];
      
      return {
        set: (ref: any, data: any) => {
          operations.push({ type: 'set', ref, data, timestamp: Date.now() });
        },
        update: (ref: any, data: any) => {
          operations.push({ type: 'update', ref, data, timestamp: Date.now() });
        },
        delete: (ref: any) => {
          operations.push({ type: 'delete', ref, data: null, timestamp: Date.now() });
        },
        commit: async () => {
          for (const op of operations) {
            const collectionName = op.ref._collectionName;
            const docId = op.ref._docId;
            
            if (op.type === 'set') {
              if (collectionName.startsWith('backup_')) {
                // Record backup operation
                backupOperations.push({
                  collectionName,
                  recordId: docId,
                  timestamp: op.timestamp,
                });
                
                if (!mockBackups.has(collectionName)) {
                  mockBackups.set(collectionName, new Map());
                }
                mockBackups.get(collectionName)!.set(docId, op.data as BackupRecord);
              } else {
                if (!mockCollections.has(collectionName)) {
                  mockCollections.set(collectionName, new Map());
                }
                mockCollections.get(collectionName)!.set(docId, op.data);
              }
            } else if (op.type === 'update') {
              // Record update operation
              updateOperations.push({
                collectionName,
                recordId: docId,
                timestamp: op.timestamp,
              });
              
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

describe('Property 10: Migration Backup Creation', () => {
  beforeEach(() => {
    mockSchools = new Map();
    mockCollections = new Map();
    mockBackups = new Map();
    backupOperations = [];
    updateOperations = [];
    vi.clearAllMocks();
  });

  // Arbitraries for generating test data
  const migratedSchoolArbitrary = fc.record({
    id: fc.uuid(),
    migrationStatus: fc.constant('migrated' as const),
    entityId: fc.uuid(),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    name: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
  });

  const unmigratedRecordArbitrary = (entityId: string, recordId: string) => fc.record({
    id: fc.constant(recordId),
    entityId: fc.option(fc.uuid(), { nil: undefined }),
    entityType: fc.option(fc.constantFrom('institution' as const, 'family' as const, 'person' as const), { nil: undefined }),
    title: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    status: fc.option(fc.constantFrom('todo', 'in_progress', 'done'), { nil: undefined }),
    createdAt: fc.option(
      fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map(d => d.toISOString()), 
      { nil: undefined }
    ),
  });

  it('should create backup for every record before updating', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 20 }).map(schools => {
          // Ensure unique school IDs
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          // Create unmigrated records
          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
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

          // Verify: Backup was created for every successfully migrated record
          const backupCollection = mockBackups.get(enrichedBatch.backupCollection);
          expect(backupCollection).toBeDefined();
          expect(backupCollection!.size).toBe(result.succeeded);

          // Verify: Each backup contains the original record data
          records.forEach(record => {
            if (!record.entityId) { // Only check unmigrated records
              const backup = backupCollection!.get(record.id);
              expect(backup).toBeDefined();
              expect(backup!.id).toBe(record.id);
              expect(backup!.entityId).toBe(record.entityId);
              expect(backup!.title).toBe(record.title);
              expect(backup!.backedUpAt).toBeDefined();
              
              // Verify optional fields are preserved
              if (record.description !== undefined) {
                expect(backup!.description).toBe(record.description);
              }
              if (record.status !== undefined) {
                expect(backup!.status).toBe(record.status);
              }
              if (record.createdAt !== undefined) {
                expect(backup!.createdAt).toBe(record.createdAt);
              }
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create backup before update (temporal ordering)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 10 }).map(schools => {
          // Ensure unique school IDs
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools and records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
            },
          }));

          const enrichedBatch: EnrichedBatch = {
            collection: collectionName,
            records: enrichedRecords,
            backupCollection: `backup_${collectionName}_entity_migration`,
          };

          // Execute: Restore the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          await migrationEngine.restore(enrichedBatch);

          // Verify: For each record, backup operation occurred before update operation
          records.forEach(record => {
            const backupOp = backupOperations.find(
              op => op.recordId === record.id && op.collectionName === enrichedBatch.backupCollection
            );
            const updateOp = updateOperations.find(
              op => op.recordId === record.id && op.collectionName === collectionName
            );

            if (backupOp && updateOp) {
              // Backup timestamp should be less than or equal to update timestamp
              expect(backupOp.timestamp).toBeLessThanOrEqual(updateOp.timestamp);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include backedUpAt timestamp in all backups', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 20 }).map(schools => {
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools and records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
            },
          }));

          const enrichedBatch: EnrichedBatch = {
            collection: collectionName,
            records: enrichedRecords,
            backupCollection: `backup_${collectionName}_entity_migration`,
          };

          // Execute: Restore the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          await migrationEngine.restore(enrichedBatch);

          // Verify: All backups have backedUpAt timestamp
          const backupCollection = mockBackups.get(enrichedBatch.backupCollection);
          expect(backupCollection).toBeDefined();

          backupCollection!.forEach((backup, recordId) => {
            expect(backup.backedUpAt).toBeDefined();
            expect(typeof backup.backedUpAt).toBe('string');
            
            // Verify it's a valid ISO timestamp
            const timestamp = new Date(backup.backedUpAt);
            expect(timestamp.toString()).not.toBe('Invalid Date');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all original fields in backup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 15 }).map(schools => {
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools and records with various fields
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
            },
          }));

          const enrichedBatch: EnrichedBatch = {
            collection: collectionName,
            records: enrichedRecords,
            backupCollection: `backup_${collectionName}_entity_migration`,
          };

          // Execute: Restore the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          await migrationEngine.restore(enrichedBatch);

          // Verify: All original fields are preserved in backup
          const backupCollection = mockBackups.get(enrichedBatch.backupCollection);
          expect(backupCollection).toBeDefined();

          records.forEach(record => {
            const backup = backupCollection!.get(record.id);
            expect(backup).toBeDefined();

            // Check all original fields are present (except backedUpAt which is added)
            const originalKeys = Object.keys(record);
            originalKeys.forEach(key => {
              expect(backup).toHaveProperty(key);
              expect((backup as any)[key]).toEqual((record as any)[key]);
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not update records without creating backups', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 20 }).map(schools => {
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools and records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
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

          // Verify: Number of backups equals number of successful updates
          const backupCollection = mockBackups.get(enrichedBatch.backupCollection);
          expect(backupCollection).toBeDefined();
          expect(backupCollection!.size).toBe(result.succeeded);

          // Verify: Every updated record has a corresponding backup
          const updatedCollection = mockCollections.get(collectionName);
          updatedCollection!.forEach((record, recordId) => {
            if (record.entityId) {
              // Record was updated, should have backup
              const backup = backupCollection!.get(recordId);
              expect(backup).toBeDefined();
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle batch processing with consistent backup creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(migratedSchoolArbitrary, { minLength: 10, maxLength: 50 }).map(schools => {
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (schools) => {
          // Setup: Create schools and records (large batch to test batch processing)
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
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

          // Verify: All records have backups regardless of batch size
          const backupCollection = mockBackups.get(enrichedBatch.backupCollection);
          expect(backupCollection).toBeDefined();
          expect(backupCollection!.size).toBe(result.succeeded);

          // Verify: Each backup is complete
          records.forEach(record => {
            if (!record.entityId) {
              const backup = backupCollection!.get(record.id);
              expect(backup).toBeDefined();
              expect(backup!.entityId).toBe(record.entityId);
              expect(backup!.backedUpAt).toBeDefined();
            }
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should create backups in correct backup collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'activities', 'forms', 'invoices', 'meetings'),
        fc.array(migratedSchoolArbitrary, { minLength: 1, maxLength: 10 }).map(schools => {
          const uniqueSchools = schools.map((school, idx) => ({
            ...school,
            id: `school_${idx}_${school.id}`,
          }));
          return uniqueSchools;
        }),
        async (collectionName, schools) => {
          // Setup: Create schools and records
          schools.forEach(school => mockSchools.set(school.id, school));

          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            schools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => collectionData.set(record.id, record));
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: schools[idx].entityId,
              entityType: schools[idx].entityType,
            },
          }));

          const expectedBackupCollection = `backup_${collectionName}_entity_migration`;
          const enrichedBatch: EnrichedBatch = {
            collection: collectionName,
            records: enrichedRecords,
            backupCollection: expectedBackupCollection,
          };

          // Execute: Restore the batch
          const migrationEngine = createMigrationEngine({} as Firestore);
          await migrationEngine.restore(enrichedBatch);

          // Verify: Backups are in the correct collection
          const backupCollection = mockBackups.get(expectedBackupCollection);
          expect(backupCollection).toBeDefined();
          expect(backupCollection!.size).toBeGreaterThan(0);

          // Verify: No backups in wrong collections (only check if other backups exist)
          if (mockBackups.size > 1) {
            mockBackups.forEach((backups, backupCollectionName) => {
              if (backupCollectionName !== expectedBackupCollection) {
                // Should not have backups for this migration in other collections
                records.forEach(record => {
                  expect(backups.has(record.id)).toBe(false);
                });
              }
            });
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
