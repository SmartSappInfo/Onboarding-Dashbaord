/**
 * Property-Based Test: Migration Verification Validation
 * 
 * **Property 15: Verification Validation**
 * **Validates: Requirements 20.3, 20.4**
 * 
 * For any migrated record in a feature collection, the verify operation should
 * confirm that both entityId and entityType fields contain valid, non-empty values.
 * 
 * Valid entityType values: 'institution', 'family', 'person'
 * Valid entityId values: non-empty strings with no whitespace-only content
 * 
 * This test uses fast-check to generate records with various invalid states
 * and verifies that the verification operation correctly identifies validation errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { createMigrationEngine } from '../migration-engine';
import type { VerificationResult } from '../migration-types';
import type { Firestore } from 'firebase/firestore';

// Mock Firestore types
type MockDocumentData = {
  id: string;
  entityId?: string;
  entityType?: string;
  [key: string]: any;
};

// In-memory storage for testing
let mockCollections: Map<string, Map<string, MockDocumentData>>;
let mockEntities: Map<string, MockDocumentData>;

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn((firestore: any, collectionName: string) => {
      return { _collectionName: collectionName };
    }),
    getDocs: vi.fn(async (collectionRef: any) => {
      const collectionName = collectionRef._collectionName;
      
      if (collectionName === 'entities') {
        const docs = Array.from(mockEntities.values()).map((data) => ({
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
      }
      
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
    doc: vi.fn((firestore: any, collectionName: string, docId: string) => {
      return { _collectionName: collectionName, _docId: docId };
    }),
    getDoc: vi.fn(async (docRef: any) => {
      if (docRef._collectionName === 'entities') {
        const entityData = mockEntities.get(docRef._docId);
        return {
          exists: (): boolean => !!entityData,
          data: (): any => entityData,
        };
      }
      return { exists: (): boolean => false };
    }),
    query: vi.fn((collectionRef: any, ...constraints: any[]) => collectionRef),
    where: vi.fn(() => ({})),
    setDoc: vi.fn(),
    writeBatch: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

describe('Property 15: Verification Validation', () => {
  beforeEach(() => {
    mockCollections = new Map();
    mockEntities = new Map();
    vi.clearAllMocks();
  });

  /**
   * Arbitrary for generating valid migrated records
   */
  const validRecordArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 15, maxLength: 30 }).filter(s => s.trim().length > 0),
    entityType: fc.constantFrom('institution', 'family', 'person'),
    title: fc.string(),
  });

  /**
   * Arbitrary for generating records with empty entityId
   * Note: Empty string '' is falsy, so it won't be counted as migrated
   * Only whitespace-only strings like ' ', '  ', etc. will be counted as migrated
   */
  const emptyEntityIdArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.constantFrom(' ', '   ', '\t', '\n', '  \t  '), // Whitespace only, not empty string
    entityType: fc.constantFrom('institution', 'family', 'person'),
    title: fc.string(),
  });

  /**
   * Arbitrary for generating records with missing entityType
   */
  const missingEntityTypeArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 15, maxLength: 30 }),
    // entityType is intentionally omitted
    title: fc.string(),
  });

  /**
   * Arbitrary for generating records with invalid entityType
   */
  const invalidEntityTypeArbitrary = fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    entityId: fc.string({ minLength: 15, maxLength: 30 }),
    entityType: fc.string({ minLength: 1 }).filter(s => 
      s.trim().length > 0 && !['institution', 'family', 'person'].includes(s)
    ),
    title: fc.string(),
  });

  it('should detect empty entityId values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(emptyEntityIdArbitrary, { minLength: 1, maxLength: 20 }),
        async (records) => {
          // Setup: Create collection with empty entityId values
          const collectionName = 'test_empty_entityid';
          const collectionData = new Map<string, MockDocumentData>();

          records.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: All records should have entityId validation errors
          const entityIdErrors = result.validationErrors.filter(e => 
            e.field === 'entityId' && e.issue === 'Empty entityId value'
          );
          
          expect(entityIdErrors.length).toBe(records.length);
          
          // Check that all record IDs are flagged
          const errorRecordIds = new Set(entityIdErrors.map(e => e.recordId));
          records.forEach(record => {
            expect(errorRecordIds.has(record.id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect missing entityType', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(missingEntityTypeArbitrary, { minLength: 1, maxLength: 20 }),
        async (records) => {
          // Setup: Create collection with missing entityType
          const collectionName = 'test_missing_entitytype';
          const collectionData = new Map<string, MockDocumentData>();

          records.forEach((record) => {
            collectionData.set(record.id, record);
            // Create entity so it's not flagged as orphaned
            mockEntities.set(record.entityId, {
              id: record.entityId,
              name: `Entity ${record.entityId}`,
              entityType: 'institution',
            });
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: All records should have entityType validation errors
          const entityTypeErrors = result.validationErrors.filter(e => 
            e.field === 'entityType' && e.issue === 'Missing entityType'
          );
          
          expect(entityTypeErrors.length).toBe(records.length);
          
          // Check that all record IDs are flagged
          const errorRecordIds = new Set(entityTypeErrors.map(e => e.recordId));
          records.forEach(record => {
            expect(errorRecordIds.has(record.id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect invalid entityType values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(invalidEntityTypeArbitrary, { minLength: 1, maxLength: 20 }),
        async (records) => {
          // Setup: Create collection with invalid entityType values
          const collectionName = 'test_invalid_entitytype';
          const collectionData = new Map<string, MockDocumentData>();

          records.forEach((record) => {
            collectionData.set(record.id, record);
            // Create entity so it's not flagged as orphaned
            mockEntities.set(record.entityId, {
              id: record.entityId,
              name: `Entity ${record.entityId}`,
              entityType: 'institution',
            });
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: All records should have entityType validation errors
          const entityTypeErrors = result.validationErrors.filter(e => 
            e.field === 'entityType' && e.issue.includes('Invalid entityType')
          );
          
          expect(entityTypeErrors.length).toBe(records.length);
          
          // Check that all record IDs are flagged
          const errorRecordIds = new Set(entityTypeErrors.map(e => e.recordId));
          records.forEach(record => {
            expect(errorRecordIds.has(record.id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept all valid entityType values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRecordArbitrary, { minLength: 1, maxLength: 50 }),
        async (records) => {
          // Setup: Create collection with valid records
          const collectionName = 'test_valid_records';
          const collectionData = new Map<string, MockDocumentData>();

          records.forEach((record) => {
            collectionData.set(record.id, record);
            // Create corresponding entity
            mockEntities.set(record.entityId, {
              id: record.entityId,
              name: `Entity ${record.entityId}`,
              entityType: record.entityType,
            });
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: No validation errors for entityId or entityType
          const fieldErrors = result.validationErrors.filter(e => 
            e.field === 'entityId' || e.field === 'entityType'
          );
          
          expect(fieldErrors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect multiple validation errors for same record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 10, maxLength: 20 }),
            entityId: fc.constantFrom(' ', '   '), // Whitespace only
            entityType: fc.string({ minLength: 1 }).filter(s => 
              s.trim().length > 0 && !['institution', 'family', 'person'].includes(s)
            ), // Invalid but not empty
            title: fc.string(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (records) => {
          // Setup: Create collection with multiple validation issues per record
          const collectionName = 'test_multiple_errors';
          const collectionData = new Map<string, MockDocumentData>();

          records.forEach((record) => {
            collectionData.set(record.id, record);
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: Each record should have at least 2 errors (entityId and entityType)
          records.forEach(record => {
            const recordErrors = result.validationErrors.filter(e => 
              e.recordId === record.id
            );
            expect(recordErrors.length).toBeGreaterThanOrEqual(2);
            
            // Should have both entityId and entityType errors
            const hasEntityIdError = recordErrors.some(e => e.field === 'entityId');
            const hasEntityTypeError = recordErrors.some(e => e.field === 'entityType');
            expect(hasEntityIdError).toBe(true);
            expect(hasEntityTypeError).toBe(true);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate entityId is non-empty string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(' ', '  ', '\t', '\n', '   \t   '), // Whitespace only, not empty string
        async (emptyValue) => {
          // Setup: Create record with whitespace-only entityId
          const collectionName = 'test_whitespace';
          const collectionData = new Map<string, MockDocumentData>();

          const record: MockDocumentData = {
            id: 'test_record',
            entityId: emptyValue,
            entityType: 'institution',
            title: 'Test',
          };
          collectionData.set(record.id, record);

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: Should have entityId validation error
          const entityIdErrors = result.validationErrors.filter(e => 
            e.recordId === 'test_record' && 
            e.field === 'entityId' && 
            e.issue === 'Empty entityId value'
          );
          
          expect(entityIdErrors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate entityType is one of allowed values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => 
          s.trim().length > 0 && !['institution', 'family', 'person'].includes(s)
        ),
        async (invalidType) => {
          // Setup: Create record with invalid entityType
          const collectionName = 'test_invalid_type';
          const collectionData = new Map<string, MockDocumentData>();

          const entityId = 'entity_test_123';
          const record: MockDocumentData = {
            id: 'test_record',
            entityId,
            entityType: invalidType,
            title: 'Test',
          };
          collectionData.set(record.id, record);

          // Create entity so it's not flagged as orphaned
          mockEntities.set(entityId, {
            id: entityId,
            name: 'Test Entity',
            entityType: 'institution',
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: Should have entityType validation error
          const entityTypeErrors = result.validationErrors.filter(e => 
            e.recordId === 'test_record' && 
            e.field === 'entityType' && 
            e.issue.includes('Invalid entityType')
          );
          
          expect(entityTypeErrors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mix of valid and invalid records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          valid: fc.array(validRecordArbitrary, { minLength: 1, maxLength: 10 }),
          emptyEntityId: fc.array(emptyEntityIdArbitrary, { minLength: 1, maxLength: 10 }),
          invalidType: fc.array(invalidEntityTypeArbitrary, { minLength: 1, maxLength: 10 }),
        }),
        async ({ valid, emptyEntityId, invalidType }) => {
          // Setup: Mix of valid and invalid records
          const collectionName = 'test_mixed_validation';
          const collectionData = new Map<string, MockDocumentData>();

          // Add valid records
          valid.forEach((record) => {
            collectionData.set(record.id, record);
            mockEntities.set(record.entityId, {
              id: record.entityId,
              name: `Entity ${record.entityId}`,
              entityType: record.entityType,
            });
          });

          // Add records with empty entityId
          emptyEntityId.forEach((record) => {
            collectionData.set(record.id, record);
          });

          // Add records with invalid entityType
          invalidType.forEach((record) => {
            collectionData.set(record.id, record);
            mockEntities.set(record.entityId, {
              id: record.entityId,
              name: `Entity ${record.entityId}`,
              entityType: 'institution',
            });
          });

          mockCollections.set(collectionName, collectionData);

          // Execute: Run verify operation
          const migrationEngine = createMigrationEngine({} as any);
          const result: VerificationResult = await migrationEngine.verify(collectionName);

          // Verify: Valid records should not have errors
          const validIds = new Set(valid.map(r => r.id));
          const validRecordErrors = result.validationErrors.filter(e => 
            validIds.has(e.recordId) && 
            (e.field === 'entityId' || e.field === 'entityType')
          );
          expect(validRecordErrors).toHaveLength(0);

          // Verify: Invalid records should have errors
          const emptyIdErrors = result.validationErrors.filter(e => 
            e.field === 'entityId' && e.issue === 'Empty entityId value'
          );
          expect(emptyIdErrors.length).toBe(emptyEntityId.length);

          const invalidTypeErrors = result.validationErrors.filter(e => 
            e.field === 'entityType' && e.issue.includes('Invalid entityType')
          );
          expect(invalidTypeErrors.length).toBe(invalidType.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate all three entityType values are accepted', async () => {
    // Setup: Create one record for each valid entityType
    const collectionName = 'test_all_types';
    const collectionData = new Map<string, MockDocumentData>();

    const types: Array<'institution' | 'family' | 'person'> = ['institution', 'family', 'person'];
    
    types.forEach((type, index) => {
      const entityId = `entity_${type}_${index}`;
      const record: MockDocumentData = {
        id: `record_${type}`,
        entityId,
        entityType: type,
        title: `Test ${type}`,
      };
      collectionData.set(record.id, record);
      mockEntities.set(entityId, {
        id: entityId,
        name: `Entity ${type}`,
        entityType: type,
      });
    });

    mockCollections.set(collectionName, collectionData);

    // Execute: Run verify operation
    const migrationEngine = createMigrationEngine({} as any);
    const result: VerificationResult = await migrationEngine.verify(collectionName);

    // Verify: No entityType validation errors
    const entityTypeErrors = result.validationErrors.filter(e => 
      e.field === 'entityType'
    );
    expect(entityTypeErrors).toHaveLength(0);
  });
});
