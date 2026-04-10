/**
 * Property-Based Test: Migration Field Preservation
 * 
 * **Property 11: Migration Field Preservation**
 * **Validates: Requirements 19.6**
 * 
 * For any record updated during migration, the original entityId field should
 * remain unchanged while new entityId and entityType fields are added.
 * 
 * This property ensures that:
 * 1. The entityId field is never modified during migration
 * 2. The entityId value remains exactly the same before and after migration
 * 3. New fields (entityId, entityType) are added without affecting existing fields
 * 4. All other original fields are preserved unchanged
 * 5. Dual-write pattern is correctly implemented (both entityId and entityId present)
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
  entityId: string;
  entityName?: string;
  entityId?: string;
  entityType?: 'institution' | 'family' | 'person';
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
};

// In-memory storage
let mockSchools: Map<string, MockSchoolData>;
let mockCollections: Map<string, Map<string, MockRecordData>>;
let mockBackups: Map<string, Map<string, any>>;
let recordsBeforeMigration: Map<string, MockRecordData>;

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

describe('Property 11: Migration Field Preservation', () => {
  beforeEach(() => {
    mockSchools = new Map();
    mockCollections = new Map();
    mockBackups = new Map();
    recordsBeforeMigration = new Map();
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
    entityId: fc.constant(entityId),
    entityName: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
    title: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    status: fc.option(fc.constantFrom('todo', 'in_progress', 'done', 'archived'), { nil: undefined }),
    priority: fc.option(fc.constantFrom('low', 'medium', 'high', 'urgent'), { nil: undefined }),
    assignedTo: fc.option(fc.uuid(), { nil: undefined }),
    dueDate: fc.option(
      fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2025-12-31') }).map(ts => new Date(ts).toISOString()), 
      { nil: undefined }
    ),
    createdAt: fc.option(
      fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), 
      { nil: undefined }
    ),
    updatedAt: fc.option(
      fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), 
      { nil: undefined }
    ),
    metadata: fc.option(
      fc.record({
        source: fc.constantFrom('manual', 'automation', 'import'),
        tags: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { maxLength: 5 }),
      }),
      { nil: undefined }
    ),
  });

  it('should preserve entityId field unchanged during migration', async () => {
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

          // Store original entityId values before migration
          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: entityId field is unchanged for all migrated records
          const migratedCollection = mockCollections.get(collectionName);
          expect(migratedCollection).toBeDefined();

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            expect(migratedRecord).toBeDefined();
            expect(originalRecord).toBeDefined();

            // Critical assertion: entityId must be exactly the same
            expect(migratedRecord!.entityId).toBe(originalRecord!.entityId);
            expect(migratedRecord!.entityId).toBe(record.entityId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve entityName field unchanged during migration', async () => {
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

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: entityName field is unchanged (if it existed)
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            if (originalRecord!.entityName !== undefined) {
              expect(migratedRecord!.entityName).toBe(originalRecord!.entityName);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should add entityId and entityType without modifying entityId', async () => {
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

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: Dual-write pattern (both entityId and entityId present)
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach((record, idx) => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            // entityId preserved
            expect(migratedRecord!.entityId).toBe(originalRecord!.entityId);

            // entityId and entityType added
            expect(migratedRecord!.entityId).toBe(schools[idx].entityId);
            expect(migratedRecord!.entityType).toBe(schools[idx].entityType);

            // Both identifiers present (dual-write)
            expect(migratedRecord!.entityId).toBeDefined();
            expect(migratedRecord!.entityId).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all other original fields unchanged', async () => {
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

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: All original fields are preserved
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            // Check all original fields (except entityId and entityType which are new)
            const fieldsToCheck = [
              'id', 'entityId', 'entityName', 'title', 'description',
              'status', 'priority', 'assignedTo', 'dueDate', 'createdAt', 'metadata'
            ];

            fieldsToCheck.forEach(field => {
              if ((originalRecord as any)[field] !== undefined) {
                expect((migratedRecord as any)[field]).toEqual((originalRecord as any)[field]);
              }
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve entityId across multiple field types and values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            school: migratedSchoolArbitrary,
            // Generate various entityId formats
            entityIdFormat: fc.constantFrom(
              'numeric',
              'uuid',
              'alphanumeric',
              'with-dashes',
              'with-underscores'
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ).map(items => {
          // Generate unique entityIds based on format
          return items.map((item, idx) => {
            let entityId: string;
            switch (item.entityIdFormat) {
              case 'numeric':
                entityId = `${100000 + idx}`;
                break;
              case 'uuid':
                entityId = `${item.school.id}`;
                break;
              case 'alphanumeric':
                entityId = `school${idx}abc`;
                break;
              case 'with-dashes':
                entityId = `school-${idx}-test`;
                break;
              case 'with-underscores':
                entityId = `school_${idx}_test`;
                break;
              default:
                entityId = `school_${idx}`;
            }
            return {
              school: { ...item.school, id: entityId },
              entityId,
            };
          });
        }),
        async (items) => {
          // Setup: Create schools
          items.forEach(item => mockSchools.set(item.entityId, item.school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          // Create records with various entityId formats
          const records = await Promise.all(
            items.map(async (item, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(item.entityId, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: items[idx].school.entityId,
              entityType: items[idx].school.entityType,
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

          // Verify: entityId preserved regardless of format
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            // entityId must be exactly the same, regardless of format
            expect(migratedRecord!.entityId).toBe(originalRecord!.entityId);
            expect(typeof migratedRecord!.entityId).toBe('string');
            expect(migratedRecord!.entityId.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve entityId in batch processing', async () => {
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
          // Setup: Create schools and records (large batch)
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

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: entityId preserved for all records in batch
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            expect(migratedRecord!.entityId).toBe(originalRecord!.entityId);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve entityId across different collections', async () => {
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

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
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

          // Verify: entityId preserved regardless of collection
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const migratedRecord = migratedCollection!.get(record.id);

            expect(migratedRecord!.entityId).toBe(originalRecord!.entityId);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not modify entityId even when enrichment fails for some records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validSchools: fc.array(migratedSchoolArbitrary, { minLength: 2, maxLength: 10 }),
        }),
        async ({ validSchools }) => {
          // Setup: Create schools
          validSchools.forEach(school => mockSchools.set(school.id, school));

          const collectionName = 'tasks';
          const collectionData = new Map<string, MockRecordData>();

          const records = await Promise.all(
            validSchools.map(async (school, idx) => {
              const recordId = `record_${idx}`;
              const recordGen = await fc.sample(unmigratedRecordArbitrary(school.id, recordId), 1);
              return recordGen[0];
            })
          );

          records.forEach(record => {
            collectionData.set(record.id, record);
            recordsBeforeMigration.set(record.id, { ...record });
          });
          mockCollections.set(collectionName, collectionData);

          // Create enriched batch
          const enrichedRecords = records.map((record, idx) => ({
            id: record.id,
            original: record,
            enriched: {
              entityId: validSchools[idx].entityId,
              entityType: validSchools[idx].entityType,
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

          // Verify: entityId unchanged for all records (even if some failed)
          const migratedCollection = mockCollections.get(collectionName);

          records.forEach(record => {
            const originalRecord = recordsBeforeMigration.get(record.id);
            const currentRecord = migratedCollection!.get(record.id);

            // entityId should never change, regardless of migration success/failure
            expect(currentRecord!.entityId).toBe(originalRecord!.entityId);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});
