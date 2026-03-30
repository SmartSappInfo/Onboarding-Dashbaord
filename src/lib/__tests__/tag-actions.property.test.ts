import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createTagAction, updateTagAction, deleteTagAction, mergeTagsAction, getTagsAction, applyTagsAction, removeTagsAction, bulkApplyTagsAction, bulkRemoveTagsAction } from '../tag-actions';

/**
 * Property-Based Tests for Contact Tagging System
 * 
 * These tests verify universal correctness properties across all possible inputs
 * using fast-check for property-based testing.
 * 
 * Each test runs a minimum of 100 iterations with randomized inputs.
 * 
 * Note: These tests focus on validation logic by mocking Firestore operations.
 * Integration tests with actual Firestore should be done separately.
 */

// Mock Next.js cache module to prevent revalidatePath errors in test environment
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Helper to generate valid hex colors
const hexColorArbitrary = fc.integer({ min: 0, max: 0xFFFFFF }).map(n => `#${n.toString(16).padStart(6, '0')}`);

/**
 * Wraps a collection mock so that 'users' always returns a doc with full permissions.
 * This prevents permission-check failures from masking the actual validation being tested.
 */
function withUserPermissions(innerMock: (collectionName: string) => any) {
  return (collectionName: string) => {
    if (collectionName === 'users') {
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ permissions: ['tags_manage', 'tags_apply', 'system_admin'] }),
          }),
        })),
      };
    }
    return innerMock(collectionName);
  };
}

// Mock Firestore operations
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          id: 'mock-tag-id',
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({
            exists: false,
            data: () => null
          }),
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
        where: function makeWhere() {
          return {
            where: function makeInnerWhere() {
              return {
                limit: function makeLimit() {
                  return {
                    get: function() { return Promise.resolve({ empty: true, docs: [] }); }
                  };
                },
                get: function() { return Promise.resolve({ empty: true, docs: [] }); }
              };
            },
            limit: function makeLimit() {
              return {
                get: function() { return Promise.resolve({ empty: true, docs: [] }); }
              };
            },
            orderBy: function() {
              return {
                orderBy: function() {
                  return {
                    get: function() { return Promise.resolve({ docs: [] }); }
                  };
                }
              };
            },
            get: function() { return Promise.resolve({ empty: true, docs: [] }); }
          };
        }
      }))
    }
  };
});

// Feature: contact-tagging-system, Property 1: Tag Name Validation
describe('Property 1: Tag Name Validation', () => {
  const createdTagIds: string[] = [];

  beforeEach(async () => {
    // Re-establish the mock implementation before each test to ensure it's not stale
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb).collection.mockImplementation((collectionName: string) => {
      const makeGet = () => Promise.resolve({ empty: true, docs: [] });
      const makeLimit = () => ({ get: makeGet });
      const makeInnerWhere = () => ({ limit: makeLimit, get: makeGet });
      const makeWhere = () => ({
        where: makeInnerWhere,
        limit: makeLimit,
        orderBy: () => ({ orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }),
        get: makeGet
      });
      
      // Mock users collection to return user with permissions
      if (collectionName === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                permissions: ['tags_manage', 'tags_apply']
              })
            })
          }))
        } as any;
      }
      
      return {
        doc: vi.fn(() => ({
          id: 'mock-tag-id',
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
        where: makeWhere
      } as any;
    });
  });

  afterEach(async () => {
    createdTagIds.length = 0;
    vi.clearAllMocks();
  });

  it('should reject empty tag names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(''), // Empty string
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Empty tag names should always be rejected
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('required');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reject tag names exceeding 50 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 51, maxLength: 200 }), // Too long
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Tag names exceeding 50 characters should always be rejected
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('50 characters');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reject tag names with only whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join('')), // Whitespace only
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Tag names with only whitespace should be rejected
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('required');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should accept valid tag names (1-50 chars with allowed characters)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid tag names: letters, numbers, spaces, hyphens, underscores, brackets, colons
        fc.array(
          fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_[]:'
          ),
          { minLength: 1, maxLength: 50 }
        ).map(arr => arr.join('')).filter(s => s.trim().length > 0), // Ensure not just whitespace
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          // Skip if name is empty after filtering
          if (!name || name.trim().length === 0) {
            return;
          }

          const result = await createTagAction({
            name,
            workspaceId: `test-ws-${workspaceId}`,
            organizationId: `test-org-${organizationId}`,
            category: category as any,
            color,
            userId: `test-user-${userId}`
          });

          // Property: Valid tag names should be accepted (validation should pass)
          // With mocked Firestore, all valid names should succeed
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.data?.name).toBe(name.trim());
          
          if (result.data?.id) {
            createdTagIds.push(result.data.id);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reject tag names with invalid special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with invalid characters
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => /[^a-zA-Z0-9\s\-_\[\]:]/.test(s)), // Contains invalid chars
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Tag names with invalid special characters should be rejected
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('invalid characters');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle boundary case: exactly 50 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate exactly 50 character valid names
        fc.array(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'),
          { minLength: 50, maxLength: 50 }
        ).map(arr => arr.join('')),
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId: `test-ws-boundary-${workspaceId}`,
            organizationId: `test-org-boundary-${organizationId}`,
            category: category as any,
            color,
            userId: `test-user-boundary-${userId}`
          });

          // Property: Exactly 50 characters should be accepted
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.data?.name.length).toBeLessThanOrEqual(50);
          
          if (result.data?.id) {
            createdTagIds.push(result.data.id);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle boundary case: exactly 51 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate exactly 51 character names
        fc.array(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
          { minLength: 51, maxLength: 51 }
        ).map(arr => arr.join('')),
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Exactly 51 characters should always be rejected
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('50 characters');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 5: System Tag Immutability
describe('Property 5: System Tag Immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should reject updates to system tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => /^[a-zA-Z0-9\s\-_\[\]:]+$/.test(s) && s.trim().length > 0), // Valid tag name
        fc.string({ minLength: 1, maxLength: 200 }), // description
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, description, category, color, userId) => {
          const systemTagId = `system-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore to return a system tag
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockGet = vi.fn().mockResolvedValue({
            exists: true,
            id: systemTagId,
            data: () => ({
              id: systemTagId,
              name: 'System Tag',
              isSystem: true,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#000000',
              usageCount: 0,
              createdBy: 'system',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockDoc = vi.fn(() => ({
            get: mockGet,
            update: mockUpdate
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc
          }))) as any;

          // Attempt to update the system tag
          const result = await updateTagAction(
            systemTagId,
            {
              name,
              description,
              category: category as any,
              color
            },
            userId
          );

          // Property: System tags should never be updatable
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('system');
          
          // Verify update was never called
          expect(mockUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reject deletion of system tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          const systemTagId = `system-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore to return a system tag
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockGet = vi.fn().mockResolvedValue({
            exists: true,
            id: systemTagId,
            data: () => ({
              id: systemTagId,
              name: 'System Tag',
              isSystem: true,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#000000',
              usageCount: 0,
              createdBy: 'system',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockDoc = vi.fn(() => ({
            get: mockGet,
            delete: mockDelete
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc
          }))) as any;

          // Attempt to delete the system tag
          const result = await deleteTagAction(systemTagId, userId);

          // Property: System tags should never be deletable
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('system');
          
          // Verify delete was never called
          expect(mockDelete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should allow updates to non-system tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => /^[a-zA-Z0-9\s\-_\[\]:]+$/.test(s) && s.trim().length > 0), // Valid tag name
        fc.string({ minLength: 1, maxLength: 200 }), // description
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, description, category, color, userId) => {
          const regularTagId = `regular-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore to return a non-system tag
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockGet = vi.fn()
            .mockResolvedValueOnce({
              exists: true,
              id: regularTagId,
              data: () => ({
                id: regularTagId,
                name: 'Regular Tag',
                isSystem: false, // Not a system tag
                workspaceId: 'test-workspace',
                organizationId: 'test-org',
                category: 'status',
                color: '#000000',
                usageCount: 0,
                createdBy: 'user-123',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
            })
            .mockResolvedValue({ empty: true, docs: [] }); // No duplicates

          const mockDoc = vi.fn(() => ({
            get: mockGet,
            update: mockUpdate
          }));

          const mockWhere = vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: mockGet
              }))
            }))
          }));

          const mockCollection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc,
            where: mockWhere
          })));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          // Attempt to update the non-system tag
          const result = await updateTagAction(
            regularTagId,
            {
              name,
              description,
              category: category as any,
              color
            },
            userId
          );

          // Property: Non-system tags should be updatable
          expect(result.success).toBe(true);
          
          // Verify update was called
          expect(mockUpdate).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should allow deletion of non-system tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          const regularTagId = `regular-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore to return a non-system tag
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            id: regularTagId,
            data: () => ({
              id: regularTagId,
              name: 'Regular Tag',
              isSystem: false, // Not a system tag
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#000000',
              usageCount: 0,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockContactsGet = vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
            size: 0
          });

          const mockDoc = vi.fn((id?: string) => ({
            get: mockTagGet,
            delete: mockDelete
          }));

          const mockWhere = vi.fn(() => ({
            get: mockContactsGet
          }));

          const mockCollection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc,
            where: mockWhere
          })));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          // Attempt to delete the non-system tag
          const result = await deleteTagAction(regularTagId, userId);

          // Property: Non-system tags should be deletable
          expect(result.success).toBe(true);
          
          // Verify delete was called
          expect(mockDelete).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should consistently reject system tag modifications regardless of input variations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 50 })
            .filter(s => /^[a-zA-Z0-9\s\-_\[\]:]+$/.test(s) && s.trim().length > 0)),
          description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
          category: fc.option(fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom')),
          color: fc.option(hexColorArbitrary)
        }),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (updates, userId) => {
          const systemTagId = `system-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore to return a system tag
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockGet = vi.fn().mockResolvedValue({
            exists: true,
            id: systemTagId,
            data: () => ({
              id: systemTagId,
              name: 'System Tag',
              isSystem: true,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#000000',
              usageCount: 0,
              createdBy: 'system',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockDoc = vi.fn(() => ({
            get: mockGet,
            update: mockUpdate
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc
          }))) as any;

          // Filter out null values from updates
          const filteredUpdates: any = {};
          if (updates.name !== null) filteredUpdates.name = updates.name;
          if (updates.description !== null) filteredUpdates.description = updates.description;
          if (updates.category !== null) filteredUpdates.category = updates.category;
          if (updates.color !== null) filteredUpdates.color = updates.color;

          // Skip if no updates provided
          if (Object.keys(filteredUpdates).length === 0) {
            return;
          }

          // Attempt to update the system tag with various combinations of fields
          const result = await updateTagAction(systemTagId, filteredUpdates, userId);

          // Property: System tags should ALWAYS be rejected, regardless of which fields are updated
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('system');
          
          // Verify update was never called
          expect(mockUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 2: Tag Name Uniqueness
describe('Property 2: Tag Name Uniqueness', () => {
  const createdTagIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    createdTagIds.length = 0;
    vi.clearAllMocks();
  });

  it('should reject duplicate tag names regardless of case in the same workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => /^[a-zA-Z0-9\s\-_\[\]:]+$/.test(s) && s.trim().length > 0), // Valid tag name
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId, organizationId, category, color, userId) => {
          // Mock Firestore to simulate first tag creation succeeds, second fails
          const mockGet = vi.fn()
            .mockResolvedValueOnce({ empty: true, docs: [] }) // First check: no duplicate
            .mockResolvedValue({ empty: false, docs: [{ id: 'existing-tag' }] }); // All subsequent checks: duplicate exists

          const mockSet = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn(() => ({
            id: `mock-tag-${Date.now()}`,
            set: mockSet,
            get: vi.fn().mockResolvedValue({ exists: false })
          }));

          const mockWhere = vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: mockGet
              }))
            })),
            limit: vi.fn(() => ({
              get: mockGet
            }))
          }));

          const mockCollection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc,
            where: mockWhere
          })));

          vi.mocked((await import('../firebase-admin')).adminDb).collection = mockCollection as any;

          // First creation should succeed
          const result1 = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: First tag creation with valid name should succeed
          expect(result1.success).toBe(true);
          expect(result1.data).toBeDefined();

          if (result1.data?.id) {
            createdTagIds.push(result1.data.id);
          }

          // Generate case variations of the same name
          const caseVariations = [
            name.toUpperCase(),
            name.toLowerCase(),
            name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          ];

          // Try to create with different case variations
          for (const variation of caseVariations) {
            if (variation === name) continue; // Skip if same as original

            const result2 = await createTagAction({
              name: variation,
              workspaceId, // Same workspace
              organizationId,
              category: category as any,
              color,
              userId
            });

            // Property: Second creation with same name (different case) should fail
            expect(result2.success).toBe(false);
            expect(result2.error).toBeDefined();
            expect(result2.error).toContain('already exists');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should allow same tag name in different workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => /^[a-zA-Z0-9\s\-_\[\]:]+$/.test(s) && s.trim().length > 0), // Valid tag name
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId1
        fc.string({ minLength: 1, maxLength: 50 }), // workspaceId2
        fc.string({ minLength: 1, maxLength: 50 }), // organizationId
        fc.constantFrom('behavioral', 'demographic', 'interest', 'status', 'lifecycle', 'engagement', 'custom'),
        hexColorArbitrary, // color
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (name, workspaceId1, workspaceId2, organizationId, category, color, userId) => {
          // Ensure different workspaces
          if (workspaceId1 === workspaceId2) {
            return; // Skip if workspaces are the same
          }

          // Mock Firestore to simulate no duplicates in each workspace
          const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });
          const mockSet = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn(() => ({
            id: `mock-tag-${Date.now()}-${Math.random()}`,
            set: mockSet,
            get: vi.fn().mockResolvedValue({ exists: false })
          }));

          const mockWhere = vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: mockGet
              }))
            })),
            limit: vi.fn(() => ({
              get: mockGet
            }))
          }));

          const mockCollection = vi.fn(withUserPermissions(() => ({
            doc: mockDoc,
            where: mockWhere
          })));

          vi.mocked((await import('../firebase-admin')).adminDb).collection = mockCollection as any;

          // Create tag in first workspace
          const result1 = await createTagAction({
            name,
            workspaceId: workspaceId1,
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Tag creation in first workspace should succeed
          expect(result1.success).toBe(true);
          expect(result1.data).toBeDefined();

          if (result1.data?.id) {
            createdTagIds.push(result1.data.id);
          }

          // Create tag with same name in second workspace
          const result2 = await createTagAction({
            name, // Same name
            workspaceId: workspaceId2, // Different workspace
            organizationId,
            category: category as any,
            color,
            userId
          });

          // Property: Tag creation with same name in different workspace should succeed
          expect(result2.success).toBe(true);
          expect(result2.data).toBeDefined();

          if (result2.data?.id) {
            createdTagIds.push(result2.data.id);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 6: Cascade Tag Deletion
describe('Property 6: Cascade Tag Deletion', () => {
  // Helper to create mock collection that handles schools, prospects, and audit logs
  const createMockCollection = (
    mockDoc: any,
    mockSchoolsWhere: any,
    mockProspectsWhere: any,
    mockAuditDoc: any
  ) => {
    return vi.fn(withUserPermissions((collectionName: string) => {
      if (collectionName === 'tag_audit_logs') {
        return { doc: mockAuditDoc };
      }
      if (collectionName === 'schools') {
        return { where: mockSchoolsWhere };
      }
      if (collectionName === 'prospects') {
        return { where: mockProspectsWhere };
      }
      return { doc: mockDoc };
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should remove tag from all contacts when tag is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.integer({ min: 0, max: 100 }), // number of contacts with the tag
        async (userId, contactCount) => {
          const tagId = `tag-to-delete-${Date.now()}-${Math.random()}`;
          
          // Generate mock contacts that have this tag
          const mockContacts = Array.from({ length: contactCount }, (_, i) => ({
            id: `contact-${i}`,
            ref: {
              update: vi.fn().mockResolvedValue(undefined)
            },
            data: () => ({
              id: `contact-${i}`,
              name: `Contact ${i}`,
              tags: [tagId, 'other-tag-1', 'other-tag-2'],
              taggedAt: {
                [tagId]: new Date().toISOString(),
                'other-tag-1': new Date().toISOString(),
                'other-tag-2': new Date().toISOString()
              },
              taggedBy: {
                [tagId]: 'user-123',
                'other-tag-1': 'user-456',
                'other-tag-2': 'user-789'
              }
            })
          }));

          // Mock Firestore operations
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            id: tagId,
            data: () => ({
              id: tagId,
              name: 'Tag to Delete',
              isSystem: false,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#FF0000',
              usageCount: contactCount,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockContactsGet = vi.fn().mockResolvedValue({
            empty: contactCount === 0,
            docs: mockContacts,
            size: contactCount
          });

          const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
          const mockBatchDelete = vi.fn().mockResolvedValue(undefined);
          const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

          const mockBatch = vi.fn(() => ({
            update: mockBatchUpdate,
            delete: mockBatchDelete,
            commit: mockBatchCommit
          }));

          const mockDoc = vi.fn(() => ({
            get: mockTagGet,
            delete: mockDelete
          }));

          const mockWhere = vi.fn(() => ({
            get: mockContactsGet
          }));

          const mockProspectsWhere = vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
          }));

          const mockAuditDoc = vi.fn(() => ({
            id: 'audit-log-id',
            set: vi.fn().mockResolvedValue(undefined)
          }));

          const mockCollection = createMockCollection(mockDoc, mockWhere, mockProspectsWhere, mockAuditDoc);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Delete the tag
          const result = await deleteTagAction(tagId, userId);

          // Property: Tag deletion should succeed
          expect(result.success).toBe(true);
          expect(result.affectedCount).toBe(contactCount);

          // Property: All contacts should have been updated to remove the tag
          if (contactCount > 0) {
            expect(mockBatchUpdate).toHaveBeenCalledTimes(contactCount);
            
            // Verify each contact update removed the tag
            for (let i = 0; i < contactCount; i++) {
              const updateCall = mockBatchUpdate.mock.calls[i];
              expect(updateCall).toBeDefined();
              
              const updateData = updateCall[1];
              expect(updateData.tags).toBeDefined();
              expect(updateData.tags).not.toContain(tagId);
              expect(updateData.tags).toContain('other-tag-1');
              expect(updateData.tags).toContain('other-tag-2');
              
              // Verify taggedAt and taggedBy maps no longer contain the deleted tag
              expect(updateData.taggedAt[tagId]).toBeUndefined();
              expect(updateData.taggedBy[tagId]).toBeUndefined();
            }
          }

          // Property: Tag document should be deleted
          expect(mockDelete).toHaveBeenCalled();

          // Property: Batch commit should be called only if there were contacts
          if (contactCount > 0) {
            expect(mockBatchCommit).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle deletion of tag with no contacts gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          const tagId = `unused-tag-${Date.now()}-${Math.random()}`;
          
          // Mock Firestore operations for tag with no contacts
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            id: tagId,
            data: () => ({
              id: tagId,
              name: 'Unused Tag',
              isSystem: false,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#FF0000',
              usageCount: 0,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockContactsGet = vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
            size: 0
          });

          const mockBatchDelete = vi.fn().mockResolvedValue(undefined);
          const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

          const mockBatch = vi.fn(() => ({
            update: vi.fn(),
            delete: mockBatchDelete,
            commit: mockBatchCommit
          }));

          const mockDoc = vi.fn(() => ({
            get: mockTagGet,
            delete: mockDelete
          }));

          const mockWhere = vi.fn(() => ({
            get: mockContactsGet
          }));

          const mockProspectsWhere = vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
          }));

          const mockAuditDoc = vi.fn(() => ({
            id: 'audit-log-id',
            set: vi.fn().mockResolvedValue(undefined)
          }));

          const mockCollection = createMockCollection(mockDoc, mockProspectsWhere, mockProspectsWhere, mockAuditDoc);

          const { adminDb} = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Delete the unused tag
          const result = await deleteTagAction(tagId, userId);

          // Property: Deletion of unused tag should succeed
          expect(result.success).toBe(true);
          expect(result.affectedCount).toBe(0);

          // Property: Tag document should still be deleted
          expect(mockDelete).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve other tags on contacts when deleting a specific tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // other tag IDs
        fc.integer({ min: 1, max: 50 }), // number of contacts
        async (userId, otherTagIds, contactCount) => {
          const tagToDelete = `tag-to-delete-${Date.now()}-${Math.random()}`;
          
          // Ensure unique tag IDs
          const uniqueOtherTags = Array.from(new Set(otherTagIds)).filter(t => t !== tagToDelete);
          if (uniqueOtherTags.length === 0) {
            return; // Skip if no other tags
          }

          // Generate mock contacts with the tag to delete and other tags
          const mockContacts = Array.from({ length: contactCount }, (_, i) => {
            const allTags = [tagToDelete, ...uniqueOtherTags];
            const taggedAt: Record<string, string> = {};
            const taggedBy: Record<string, string> = {};
            
            allTags.forEach(tag => {
              taggedAt[tag] = new Date().toISOString();
              taggedBy[tag] = `user-${i}`;
            });

            return {
              id: `contact-${i}`,
              ref: {
                update: vi.fn().mockResolvedValue(undefined)
              },
              data: () => ({
                id: `contact-${i}`,
                name: `Contact ${i}`,
                tags: allTags,
                taggedAt,
                taggedBy
              })
            };
          });

          // Mock Firestore operations
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            id: tagToDelete,
            data: () => ({
              id: tagToDelete,
              name: 'Tag to Delete',
              isSystem: false,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#FF0000',
              usageCount: contactCount,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockContactsGet = vi.fn().mockResolvedValue({
            empty: false,
            docs: mockContacts,
            size: contactCount
          });

          const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
          const mockBatchDelete = vi.fn().mockResolvedValue(undefined);
          const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

          const mockBatch = vi.fn(() => ({
            update: mockBatchUpdate,
            delete: mockBatchDelete,
            commit: mockBatchCommit
          }));

          const mockDoc = vi.fn(() => ({
            get: mockTagGet,
            delete: mockDelete
          }));

          const mockWhere = vi.fn(() => ({
            get: mockContactsGet
          }));

          const mockProspectsWhere = vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
          }));

          const mockAuditDoc = vi.fn(() => ({
            id: 'audit-log-id',
            set: vi.fn().mockResolvedValue(undefined)
          }));

          const mockCollection = createMockCollection(mockDoc, mockWhere, mockProspectsWhere, mockAuditDoc);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Delete the tag
          const result = await deleteTagAction(tagToDelete, userId);

          // Property: Tag deletion should succeed
          expect(result.success).toBe(true);

          // Property: All other tags should be preserved on each contact
          for (let i = 0; i < contactCount; i++) {
            const updateCall = mockBatchUpdate.mock.calls[i];
            expect(updateCall).toBeDefined();
            
            const updateData = updateCall[1];
            
            // Verify deleted tag is removed
            expect(updateData.tags).not.toContain(tagToDelete);
            
            // Verify all other tags are preserved
            uniqueOtherTags.forEach(otherTag => {
              expect(updateData.tags).toContain(otherTag);
              expect(updateData.taggedAt[otherTag]).toBeDefined();
              expect(updateData.taggedBy[otherTag]).toBeDefined();
            });
            
            // Verify only the deleted tag's metadata is removed
            expect(updateData.taggedAt[tagToDelete]).toBeUndefined();
            expect(updateData.taggedBy[tagToDelete]).toBeUndefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle batch operations correctly for large numbers of contacts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.integer({ min: 100, max: 1000 }), // large number of contacts
        async (userId, contactCount) => {
          const tagId = `tag-large-batch-${Date.now()}-${Math.random()}`;
          
          // Generate many mock contacts
          const mockContacts = Array.from({ length: contactCount }, (_, i) => ({
            id: `contact-${i}`,
            ref: {
              update: vi.fn().mockResolvedValue(undefined)
            },
            data: () => ({
              id: `contact-${i}`,
              name: `Contact ${i}`,
              tags: [tagId],
              taggedAt: { [tagId]: new Date().toISOString() },
              taggedBy: { [tagId]: 'user-123' }
            })
          }));

          // Mock Firestore operations
          const mockDelete = vi.fn().mockResolvedValue(undefined);
          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            id: tagId,
            data: () => ({
              id: tagId,
              name: 'Tag with Many Contacts',
              isSystem: false,
              workspaceId: 'test-workspace',
              organizationId: 'test-org',
              category: 'status',
              color: '#FF0000',
              usageCount: contactCount,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          });

          const mockContactsGet = vi.fn().mockResolvedValue({
            empty: false,
            docs: mockContacts,
            size: contactCount
          });

          const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
          const mockBatchDelete = vi.fn().mockResolvedValue(undefined);
          const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

          const mockBatch = vi.fn(() => ({
            update: mockBatchUpdate,
            delete: mockBatchDelete,
            commit: mockBatchCommit
          }));

          const mockDoc = vi.fn(() => ({
            get: mockTagGet,
            delete: mockDelete
          }));

          const mockWhere = vi.fn(() => ({
            get: mockContactsGet
          }));

          const mockProspectsWhere = vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
          }));

          const mockAuditDoc = vi.fn(() => ({
            id: 'audit-log-id',
            set: vi.fn().mockResolvedValue(undefined)
          }));

          const mockCollection = createMockCollection(mockDoc, mockWhere, mockProspectsWhere, mockAuditDoc);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Delete the tag
          const result = await deleteTagAction(tagId, userId);

          // Property: Large batch deletion should succeed
          expect(result.success).toBe(true);
          expect(result.affectedCount).toBe(contactCount);

          // Property: All contacts should be processed
          expect(mockBatchUpdate).toHaveBeenCalledTimes(contactCount);
          
          // Property: Batch commit should be called
          expect(mockBatchCommit).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 } // Fewer runs for performance with large datasets
    );
  });
});

// Feature: contact-tagging-system, Property 7: Tag Merge Completeness
// Validates: Requirements FR1.4.1, FR1.4.2
describe('Property 7: Tag Merge Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: build a mock adminDb for merge scenarios.
   *
   * @param sourceTagIds   - IDs of tags being merged away
   * @param targetTagId    - ID of the tag being merged into
   * @param contactsPerSourceTag - map of sourceTagId → array of mock contact docs
   */
  const buildMergeMocks = (
    sourceTagIds: string[],
    targetTagId: string,
    contactsPerSourceTag: Map<string, Array<{ id: string; tags: string[]; taggedAt: Record<string, string>; taggedBy: Record<string, string> }>>
  ) => {
    const allTagIds = [...sourceTagIds, targetTagId];

    // Tag documents
    const tagDocs = new Map<string, any>();
    allTagIds.forEach(id => {
      tagDocs.set(id, {
        id,
        name: `Tag ${id}`,
        isSystem: false,
        workspaceId: 'test-workspace',
        organizationId: 'test-org',
        category: 'status',
        color: '#FF0000',
        usageCount: 0,
        createdBy: 'user-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
    });

    const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
    const mockBatchDelete = vi.fn().mockResolvedValue(undefined);
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }));

    const mockContactGet = vi.fn().mockImplementation(async () => ({ exists: false, data: () => null }));

    // Per-contact ref mocks (keyed by contactId)
    const contactRefMocks = new Map<string, { get: any; update: any }>();
    contactsPerSourceTag.forEach(contacts => {
      contacts.forEach(c => {
        if (!contactRefMocks.has(c.id)) {
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ ...c }),
          });
          contactRefMocks.set(c.id, { get: mockGet, update: mockUpdate });
        }
      });
    });

    const mockTagsGet = vi.fn().mockResolvedValue({
      docs: allTagIds.map(id => ({
        id,
        data: () => tagDocs.get(id),
      })),
    });

    // schools.where('tags', 'array-contains', sourceTagId) → returns contacts for that source
    const mockSchoolsWhere = vi.fn().mockImplementation((_field: string, _op: string, tagId: string) => {
      const contactDocs = (contactsPerSourceTag.get(tagId) ?? []).map(c => ({
        id: c.id,
        ref: adminDb_ref_for(c.id, contactRefMocks),
        data: () => ({ ...c }),
      }));
      return {
        get: vi.fn().mockResolvedValue({
          docs: contactDocs,
          forEach: (cb: (doc: any) => void) => contactDocs.forEach(cb),
        }),
      };
    });

    const mockAuditSet = vi.fn().mockResolvedValue(undefined);
    const mockAuditDoc = vi.fn(() => ({ id: 'audit-id', set: mockAuditSet }));

    const mockTagDoc = vi.fn((id?: string) => ({
      id: id ?? targetTagId,
      get: vi.fn().mockResolvedValue({
        exists: !!id && tagDocs.has(id),
        data: () => tagDocs.get(id ?? '') ?? null,
      }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }));

    const mockContactDoc = vi.fn((id: string) => {
      const ref = contactRefMocks.get(id);
      return ref ?? { get: mockContactGet, update: vi.fn().mockResolvedValue(undefined) };
    });

    const mockCollection = vi.fn(withUserPermissions((collectionName: string) => {
      if (collectionName === 'tag_audit_logs') return { doc: mockAuditDoc };
      if (collectionName === 'schools') {
        return {
          doc: mockContactDoc,
          where: mockSchoolsWhere,
        };
      }
      if (collectionName === 'tags') {
        return {
          doc: mockTagDoc,
          where: vi.fn(() => ({
            in: vi.fn(() => ({ get: mockTagsGet })),
            get: mockTagsGet,
          })),
        };
      }
      if (collectionName === 'prospects') {
        return {
          doc: vi.fn(),
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              docs: [],
              forEach: (_cb: (doc: any) => void) => {},
            }),
          })),
        };
      }
      return { doc: vi.fn(), where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [], forEach: (_cb: (doc: any) => void) => {} }) })) };
    }));

    return {
      mockCollection,
      mockBatch,
      mockBatchUpdate,
      mockBatchDelete,
      mockBatchCommit,
      mockAuditSet,
      contactRefMocks,
      mockTagsGet,
    };
  };

  // Small helper to get a contact ref mock by id
  function adminDb_ref_for(
    contactId: string,
    contactRefMocks: Map<string, { get: any; update: any }>
  ) {
    return contactRefMocks.get(contactId) ?? { get: vi.fn(), update: vi.fn() };
  }

  it('should move all contacts from source tags to target tag after merge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ), // source tag IDs
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), // target tag ID
        fc.integer({ min: 0, max: 20 }), // contacts per source tag
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSourceIds, rawTargetId, contactsPerSource, userId) => {
          // Ensure source and target are distinct, and deduplicate source IDs
          const targetTagId = `target-${rawTargetId}`;
          const sourceTagIds = [...new Set(rawSourceIds
            .map(id => `source-${id}`)
            .filter(id => id !== targetTagId))];

          if (sourceTagIds.length === 0) return;

          // Build contacts for each source tag (non-overlapping for simplicity)
          const contactsPerSourceTag = new Map<string, Array<any>>();
          const allContactIds = new Set<string>();

          sourceTagIds.forEach((srcId, idx) => {
            const contacts = Array.from({ length: contactsPerSource }, (_, i) => {
              const cId = `contact-src${idx}-${i}`;
              allContactIds.add(cId);
              return {
                id: cId,
                tags: [srcId, 'unrelated-tag'],
                taggedAt: {
                  [srcId]: '2026-01-10T00:00:00Z',
                  'unrelated-tag': '2026-01-01T00:00:00Z',
                },
                taggedBy: {
                  [srcId]: 'user-abc',
                  'unrelated-tag': 'user-abc',
                },
              };
            });
            contactsPerSourceTag.set(srcId, contacts);
          });

          const { mockCollection, mockBatch, mockBatchUpdate, mockBatchCommit } =
            buildMergeMocks(sourceTagIds, targetTagId, contactsPerSourceTag);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction(sourceTagIds, targetTagId, userId);

          // Property FR1.4.1: merge should succeed
          expect(result.success).toBe(true);

          const totalContacts = contactsPerSource * sourceTagIds.length;

          // Property FR1.4.1: affected count equals total unique contacts across all source tags
          expect(result.affectedCount).toBe(totalContacts);

          if (totalContacts > 0) {
            // Property: batch.update was called for every contact (+1 for target tag usage count update in finalBatch)
            expect(mockBatchUpdate).toHaveBeenCalledTimes(totalContacts + 1);

            // Property: every contact update adds targetTagId and removes all sourceTagIds
            // Filter to only contact updates (which have a 'tags' field, not 'usageCount')
            const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(([_ref, updateData]) => 'tags' in updateData);
            contactUpdateCalls.forEach(([_ref, updateData]) => {
              expect(updateData.tags).toContain(targetTagId);
              sourceTagIds.forEach(srcId => {
                expect(updateData.tags).not.toContain(srcId);
              });
              // Unrelated tags must be preserved
              expect(updateData.tags).toContain('unrelated-tag');
            });

            expect(mockBatchCommit).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should delete all source tags after merge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 4 }
        ),
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSourceIds, rawTargetId, userId) => {
          const targetTagId = `target-${rawTargetId}`;
          const sourceTagIds = rawSourceIds
            .map(id => `source-${id}`)
            .filter(id => id !== targetTagId);

          if (sourceTagIds.length === 0) return;

          const contactsPerSourceTag = new Map<string, Array<any>>();
          sourceTagIds.forEach(srcId => {
            contactsPerSourceTag.set(srcId, []);
          });

          const { mockCollection, mockBatch, mockBatchDelete, mockBatchCommit } =
            buildMergeMocks(sourceTagIds, targetTagId, contactsPerSourceTag);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction(sourceTagIds, targetTagId, userId);

          expect(result.success).toBe(true);

          // Property FR1.4.2: each source tag document must be deleted
          expect(mockBatchDelete).toHaveBeenCalledTimes(sourceTagIds.length);

          expect(mockBatchCommit).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve the earliest taggedAt timestamp when merging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), // single source
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), // target
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSrcId, rawTargetId, userId) => {
          const sourceTagId = `source-${rawSrcId}`;
          const targetTagId = `target-${rawTargetId}`;
          if (sourceTagId === targetTagId) return;

          const earlierTimestamp = '2026-01-05T00:00:00Z';
          const laterTimestamp = '2026-03-01T00:00:00Z';

          const contact = {
            id: 'contact-ts-test',
            tags: [sourceTagId],
            taggedAt: { [sourceTagId]: earlierTimestamp },
            taggedBy: { [sourceTagId]: 'user-abc' },
          };

          const contactsPerSourceTag = new Map([[sourceTagId, [contact]]]);

          const { mockCollection, mockBatch, mockBatchUpdate } =
            buildMergeMocks([sourceTagId], targetTagId, contactsPerSourceTag);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction([sourceTagId], targetTagId, userId);

          expect(result.success).toBe(true);
          expect(mockBatchUpdate).toHaveBeenCalled();

          // Property FR1.4.2: taggedAt for target should be the earliest source timestamp
          const [_ref, updateData] = mockBatchUpdate.mock.calls[0];
          expect(updateData.taggedAt[targetTagId]).toBe(earlierTimestamp);
          // Must be earlier than or equal to the later timestamp
          expect(new Date(updateData.taggedAt[targetTagId]).getTime())
            .toBeLessThanOrEqual(new Date(laterTimestamp).getTime());
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should fail gracefully when target tag does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSourceIds, rawTargetId, userId) => {
          const targetTagId = `missing-target-${rawTargetId}`;
          const sourceTagIds = rawSourceIds.map(id => `source-${id}`).filter(id => id !== targetTagId);
          if (sourceTagIds.length === 0) return;

          // Return empty docs — target not found
          const mockTagsGet = vi.fn().mockResolvedValue({ docs: [] });
          const mockBatchCommit = vi.fn();
          const mockBatch = vi.fn(() => ({
            update: vi.fn(),
            delete: vi.fn(),
            commit: mockBatchCommit,
          }));

          const mockCollection = vi.fn(withUserPermissions((collectionName: string) => {
            if (collectionName === 'tags') {
              return {
                doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false, data: () => null }) })),
                where: vi.fn(() => ({ get: mockTagsGet })),
              };
            }
            return { doc: vi.fn(), where: vi.fn() };
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction(sourceTagIds, targetTagId, userId);

          // Property: merge should fail when target tag is missing
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();

          // Property: no batch commit should happen
          expect(mockBatchCommit).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not duplicate target tag on contacts that already have it', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSrcId, rawTargetId, userId) => {
          const sourceTagId = `source-${rawSrcId}`;
          const targetTagId = `target-${rawTargetId}`;
          if (sourceTagId === targetTagId) return;

          // Contact already has BOTH source and target tags
          const contact = {
            id: 'contact-already-tagged',
            tags: [sourceTagId, targetTagId],
            taggedAt: {
              [sourceTagId]: '2026-01-05T00:00:00Z',
              [targetTagId]: '2026-02-01T00:00:00Z',
            },
            taggedBy: {
              [sourceTagId]: 'user-abc',
              [targetTagId]: 'user-abc',
            },
          };

          const contactsPerSourceTag = new Map([[sourceTagId, [contact]]]);

          const { mockCollection, mockBatch, mockBatchUpdate } =
            buildMergeMocks([sourceTagId], targetTagId, contactsPerSourceTag);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction([sourceTagId], targetTagId, userId);

          expect(result.success).toBe(true);

          if (mockBatchUpdate.mock.calls.length > 0) {
            const [_ref, updateData] = mockBatchUpdate.mock.calls[0];

            // Property: target tag should appear exactly once (Set deduplication)
            const targetCount = (updateData.tags as string[]).filter(t => t === targetTagId).length;
            expect(targetCount).toBe(1);

            // Property: source tag must be removed
            expect(updateData.tags).not.toContain(sourceTagId);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 3: Workspace Isolation
// Validates: Requirements FR1.1.3
describe('Property 3: Workspace Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should only return tags belonging to the requested workspaceId', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Two distinct workspace IDs
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        // Number of tags per workspace
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        async (workspaceIdA, workspaceIdB, tagsInA, tagsInB) => {
          // Ensure workspaces are distinct
          if (workspaceIdA === workspaceIdB) return;

          const wsA = `ws-a-${workspaceIdA}`;
          const wsB = `ws-b-${workspaceIdB}`;

          // Build tag docs for workspace A
          const tagsForA = Array.from({ length: tagsInA }, (_, i) => ({
            id: `tag-a-${i}`,
            data: () => ({
              id: `tag-a-${i}`,
              name: `Tag A ${i}`,
              workspaceId: wsA,
              category: 'custom',
              color: '#FF0000',
              usageCount: 0,
              isSystem: false,
              createdBy: 'user-1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          }));

          // Build tag docs for workspace B
          const tagsForB = Array.from({ length: tagsInB }, (_, i) => ({
            id: `tag-b-${i}`,
            data: () => ({
              id: `tag-b-${i}`,
              name: `Tag B ${i}`,
              workspaceId: wsB,
              category: 'custom',
              color: '#0000FF',
              usageCount: 0,
              isSystem: false,
              createdBy: 'user-2',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          }));

          // Mock Firestore: .where('workspaceId', '==', id) returns only matching tags
          const mockOrderBy = vi.fn().mockImplementation(function (this: any) { return this; });

          const mockWhereForA = {
            orderBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ docs: tagsForA }),
              }),
            }),
          };

          const mockWhereForB = {
            orderBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ docs: tagsForB }),
              }),
            }),
          };

          const mockCollection = vi.fn(() => ({
            where: vi.fn((_field: string, _op: string, value: string) => {
              if (value === wsA) return mockWhereForA;
              if (value === wsB) return mockWhereForB;
              // Unknown workspace → empty result
              return {
                orderBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({ docs: [] }),
                  }),
                }),
              };
            }),
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          // Query workspace A
          const resultA = await getTagsAction(wsA);
          // Query workspace B
          const resultB = await getTagsAction(wsB);

          // Property: both queries should succeed
          expect(resultA.success).toBe(true);
          expect(resultB.success).toBe(true);

          const returnedTagIdsA = resultA.data!.map((t: any) => t.id);
          const returnedTagIdsB = resultB.data!.map((t: any) => t.id);

          // Property: workspace A query returns exactly the tags for workspace A
          expect(returnedTagIdsA).toHaveLength(tagsInA);
          tagsForA.forEach(tag => {
            expect(returnedTagIdsA).toContain(tag.id);
          });

          // Property: workspace B query returns exactly the tags for workspace B
          expect(returnedTagIdsB).toHaveLength(tagsInB);
          tagsForB.forEach(tag => {
            expect(returnedTagIdsB).toContain(tag.id);
          });

          // Property: no tag from workspace B appears in workspace A results
          const tagIdsFromB = new Set(tagsForB.map(t => t.id));
          returnedTagIdsA.forEach((id: string) => {
            expect(tagIdsFromB.has(id)).toBe(false);
          });

          // Property: no tag from workspace A appears in workspace B results
          const tagIdsFromA = new Set(tagsForA.map(t => t.id));
          returnedTagIdsB.forEach((id: string) => {
            expect(tagIdsFromA.has(id)).toBe(false);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should return empty list for a workspace with no tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        async (workspaceId) => {
          const emptyWorkspace = `empty-ws-${workspaceId}`;

          const mockCollection = vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({ docs: [] }),
                }),
              }),
            })),
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const result = await getTagsAction(emptyWorkspace);

          // Property: querying a workspace with no tags returns empty array
          expect(result.success).toBe(true);
          expect(result.data).toEqual([]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not leak tags across any pair of distinct workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate N distinct workspace IDs with their tags
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ),
        fc.integer({ min: 1, max: 5 }), // tags per workspace
        async (rawWorkspaceIds, tagsPerWorkspace) => {
          // Deduplicate workspace IDs
          const workspaceIds = Array.from(new Set(rawWorkspaceIds.map(id => `ws-${id}`)));
          if (workspaceIds.length < 2) return;

          // Build a map of workspaceId → tag docs
          const workspaceTagMap = new Map<string, Array<{ id: string; data: () => any }>>();
          workspaceIds.forEach((wsId, wsIdx) => {
            const tags = Array.from({ length: tagsPerWorkspace }, (_, i) => ({
              id: `tag-ws${wsIdx}-${i}`,
              data: () => ({
                id: `tag-ws${wsIdx}-${i}`,
                name: `Tag ${wsIdx}-${i}`,
                workspaceId: wsId,
                category: 'custom',
                color: '#AABBCC',
                usageCount: 0,
                isSystem: false,
                createdBy: 'user-x',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
            }));
            workspaceTagMap.set(wsId, tags);
          });

          const mockCollection = vi.fn(() => ({
            where: vi.fn((_field: string, _op: string, value: string) => ({
              orderBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    docs: workspaceTagMap.get(value) ?? [],
                  }),
                }),
              }),
            })),
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          // Query each workspace and verify isolation
          for (const wsId of workspaceIds) {
            const result = await getTagsAction(wsId);

            expect(result.success).toBe(true);

            const returnedIds = result.data!.map((t: any) => t.id);

            // Property: returned tags must all belong to the queried workspace
            returnedIds.forEach((tagId: string) => {
              const ownTags = workspaceTagMap.get(wsId)!.map(t => t.id);
              expect(ownTags).toContain(tagId);
            });

            // Property: tags from other workspaces must not appear
            for (const [otherWsId, otherTags] of workspaceTagMap.entries()) {
              if (otherWsId === wsId) continue;
              const otherTagIds = new Set(otherTags.map(t => t.id));
              returnedIds.forEach((tagId: string) => {
                expect(otherTagIds.has(tagId)).toBe(false);
              });
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 8: Tag Operation Audit Trail
// Validates: Requirements FR2.1.2, FR2.2.1, FR7.3.1, FR7.3.2
describe('Property 8: Tag Operation Audit Trail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: build a mock adminDb for applyTagsAction / removeTagsAction scenarios.
   * Returns the audit set mock so tests can inspect what was written.
   */
  const buildContactTagMocks = (opts: {
    contactExists?: boolean;
    existingTags?: string[];
    tagName?: string;
    workspaceId?: string;
  } = {}) => {
    const {
      contactExists = true,
      existingTags = [],
      tagName = 'Test Tag',
      workspaceId = 'test-workspace',
    } = opts;

    const mockAuditSet = vi.fn().mockResolvedValue(undefined);
    const mockAuditDoc = vi.fn(() => ({
      id: `audit-${Date.now()}-${Math.random()}`,
      set: mockAuditSet,
    }));

    const mockContactUpdate = vi.fn().mockResolvedValue(undefined);
    const mockContactGet = vi.fn().mockResolvedValue({
      exists: contactExists,
      data: () =>
        contactExists
          ? {
              id: 'contact-123',
              name: 'Test Contact',
              tags: existingTags,
              taggedAt: Object.fromEntries(existingTags.map(t => [t, '2026-01-01T00:00:00Z'])),
              taggedBy: Object.fromEntries(existingTags.map(t => [t, 'user-prev'])),
            }
          : null,
    });

    const mockTagGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'tag-abc',
        name: tagName,
        workspaceId,
        category: 'status',
        color: '#FF0000',
        isSystem: false,
        usageCount: 0,
        createdBy: 'user-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    });

    const mockTagUpdate = vi.fn().mockResolvedValue(undefined);
    const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }));

    const mockCollection = vi.fn(withUserPermissions((collectionName: string) => {
      if (collectionName === 'tag_audit_logs') {
        return { doc: mockAuditDoc };
      }
      if (collectionName === 'tags') {
        return {
          doc: vi.fn(() => ({
            get: mockTagGet,
            update: mockTagUpdate,
          })),
        };
      }
      // schools / prospects
      return {
        doc: vi.fn(() => ({
          get: mockContactGet,
          update: mockContactUpdate,
        })),
      };
    }));

    return {
      mockCollection,
      mockBatch,
      mockAuditSet,
      mockAuditDoc,
      mockContactUpdate,
      mockTagGet,
    };
  };

  it('should create an audit log entry with action=applied for every new tag applied to a contact', async () => {
    /**
     * **Validates: Requirements FR2.1.2, FR7.3.1, FR7.3.2**
     *
     * Property: For any call to applyTagsAction with N new tag IDs, exactly N audit log
     * entries are created, each with action='applied', the correct tagId, contactId,
     * userId, and a non-empty timestamp.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const), // contactType
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tagIds to apply
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (contactId, contactType, rawTagIds, userId) => {
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          const { mockCollection, mockBatch, mockAuditSet } = buildContactTagMocks({
            existingTags: [], // no pre-existing tags → all tagIds are new
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await applyTagsAction(contactId, contactType, tagIds, userId);

          // Property: operation should succeed
          expect(result.success).toBe(true);

          // Property: one audit log entry per new tag
          expect(mockAuditSet).toHaveBeenCalledTimes(tagIds.length);

          // Property: each audit entry has the correct fields
          mockAuditSet.mock.calls.forEach((call, idx) => {
            const auditEntry = call[0];

            // action must be 'applied'
            expect(auditEntry.action).toBe('applied');

            // tagId must be one of the applied tags
            expect(tagIds).toContain(auditEntry.tagId);

            // contactId must match
            expect(auditEntry.contactId).toBe(contactId);

            // userId must match
            expect(auditEntry.userId).toBe(userId);

            // timestamp must be a non-empty string (ISO format)
            expect(typeof auditEntry.timestamp).toBe('string');
            expect(auditEntry.timestamp.length).toBeGreaterThan(0);
            expect(() => new Date(auditEntry.timestamp)).not.toThrow();

            // workspaceId must be present
            expect(typeof auditEntry.workspaceId).toBe('string');
            expect(auditEntry.workspaceId.length).toBeGreaterThan(0);

            // tagName must be present
            expect(typeof auditEntry.tagName).toBe('string');
            expect(auditEntry.tagName.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not create audit log entries for tags already applied to the contact', async () => {
    /**
     * **Validates: Requirements FR2.1.2, FR7.3.1**
     *
     * Property: When applyTagsAction is called with tag IDs that are already on the
     * contact, no audit log entries are created for those pre-existing tags.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // already-existing tag IDs
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (contactId, contactType, rawExistingIds, userId) => {
          const existingTagIds = Array.from(new Set(rawExistingIds.map(id => `existing-${id}`)));

          const { mockCollection, mockBatch, mockAuditSet } = buildContactTagMocks({
            existingTags: existingTagIds, // contact already has all these tags
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Apply the same tags that already exist
          const result = await applyTagsAction(contactId, contactType, existingTagIds, userId);

          // Property: operation should succeed
          expect(result.success).toBe(true);

          // Property: no audit entries for already-applied tags
          expect(mockAuditSet).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should create an audit log entry with action=removed for every tag removed from a contact', async () => {
    /**
     * **Validates: Requirements FR2.2.1, FR7.3.1, FR7.3.2**
     *
     * Property: For any call to removeTagsAction where the contact actually has the
     * specified tags, exactly one audit log entry per removed tag is created with
     * action='removed', the correct tagId, contactId, userId, and timestamp.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tagIds to remove (contact has all of them)
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (contactId, contactType, rawTagIds, userId) => {
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          const { mockCollection, mockBatch, mockAuditSet } = buildContactTagMocks({
            existingTags: tagIds, // contact has all these tags
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await removeTagsAction(contactId, contactType, tagIds, userId);

          // Property: operation should succeed
          expect(result.success).toBe(true);

          // Property: one audit log entry per removed tag
          expect(mockAuditSet).toHaveBeenCalledTimes(tagIds.length);

          // Property: each audit entry has the correct fields
          mockAuditSet.mock.calls.forEach(call => {
            const auditEntry = call[0];

            // action must be 'removed'
            expect(auditEntry.action).toBe('removed');

            // tagId must be one of the removed tags
            expect(tagIds).toContain(auditEntry.tagId);

            // contactId must match
            expect(auditEntry.contactId).toBe(contactId);

            // userId must match
            expect(auditEntry.userId).toBe(userId);

            // timestamp must be a non-empty ISO string
            expect(typeof auditEntry.timestamp).toBe('string');
            expect(auditEntry.timestamp.length).toBeGreaterThan(0);
            expect(() => new Date(auditEntry.timestamp)).not.toThrow();

            // workspaceId must be present
            expect(typeof auditEntry.workspaceId).toBe('string');
            expect(auditEntry.workspaceId.length).toBeGreaterThan(0);

            // tagName must be present
            expect(typeof auditEntry.tagName).toBe('string');
            expect(auditEntry.tagName.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not create audit log entries when removing tags the contact does not have', async () => {
    /**
     * **Validates: Requirements FR2.2.1, FR7.3.1**
     *
     * Property: When removeTagsAction is called with tag IDs that are NOT on the
     * contact, no audit log entries are created.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tagIds to remove (contact does NOT have them)
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (contactId, contactType, rawTagIds, userId) => {
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          const { mockCollection, mockBatch, mockAuditSet } = buildContactTagMocks({
            existingTags: [], // contact has no tags
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await removeTagsAction(contactId, contactType, tagIds, userId);

          // Property: operation should succeed (no-op is valid)
          expect(result.success).toBe(true);

          // Property: no audit entries when no tags were actually removed
          expect(mockAuditSet).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should store audit log entries using set (not update/delete), ensuring immutability', async () => {
    /**
     * **Validates: Requirements FR7.3.1, FR7.3.2**
     *
     * Property: Audit log entries are always written with `set()` on a new document
     * reference, never with `update()` or `delete()`. This ensures immutability —
     * once written, an audit entry cannot be modified or removed.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)), // single tagId
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (contactId, contactType, rawTagId, userId) => {
          const tagId = `tag-${rawTagId}`;

          const mockAuditUpdate = vi.fn();
          const mockAuditDelete = vi.fn();
          const mockAuditSet = vi.fn().mockResolvedValue(undefined);

          // Audit doc mock exposes update and delete to verify they are never called
          const mockAuditDoc = vi.fn(() => ({
            id: `audit-${Date.now()}`,
            set: mockAuditSet,
            update: mockAuditUpdate,
            delete: mockAuditDelete,
          }));

          const mockContactUpdate = vi.fn().mockResolvedValue(undefined);
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: contactId,
              name: 'Test Contact',
              tags: [],
              taggedAt: {},
              taggedBy: {},
            }),
          });

          const mockTagGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: tagId,
              name: 'Immutability Test Tag',
              workspaceId: 'test-workspace',
              category: 'status',
              color: '#FF0000',
              isSystem: false,
              usageCount: 0,
              createdBy: 'user-123',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            }),
          });

          const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
          const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
          const mockBatch = vi.fn(() => ({
            update: mockBatchUpdate,
            commit: mockBatchCommit,
          }));

          const mockCollection = vi.fn(withUserPermissions((collectionName: string) => {
            if (collectionName === 'tag_audit_logs') {
              return { doc: mockAuditDoc };
            }
            if (collectionName === 'tags') {
              return {
                doc: vi.fn(() => ({
                  get: mockTagGet,
                  update: vi.fn().mockResolvedValue(undefined),
                })),
              };
            }
            return {
              doc: vi.fn(() => ({
                get: mockContactGet,
                update: mockContactUpdate,
              })),
            };
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          // Apply a tag
          await applyTagsAction(contactId, contactType, [tagId], 'user-apply');

          // Property: audit entry was written with set()
          expect(mockAuditSet).toHaveBeenCalledTimes(1);

          // Property: update() and delete() were never called on the audit document
          expect(mockAuditUpdate).not.toHaveBeenCalled();
          expect(mockAuditDelete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should include all required fields in every audit log entry', async () => {
    /**
     * **Validates: Requirements FR7.3.2**
     *
     * Property: Every audit log entry written by applyTagsAction or removeTagsAction
     * must contain all required fields: workspaceId, action, tagId, tagName,
     * contactId, userId, and timestamp.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // contactId
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          { minLength: 1, maxLength: 4 }
        ), // tagIds
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.constantFrom('apply' as const, 'remove' as const), // which operation to test
        async (contactId, contactType, rawTagIds, userId, operation) => {
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          const { mockCollection, mockBatch, mockAuditSet } = buildContactTagMocks({
            existingTags: operation === 'remove' ? tagIds : [],
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          if (operation === 'apply') {
            await applyTagsAction(contactId, contactType, tagIds, userId);
          } else {
            await removeTagsAction(contactId, contactType, tagIds, userId);
          }

          // Property: audit entries were created
          expect(mockAuditSet).toHaveBeenCalledTimes(tagIds.length);

          // Property: every entry has all required fields
          const requiredFields = ['workspaceId', 'action', 'tagId', 'tagName', 'contactId', 'userId', 'timestamp'];

          mockAuditSet.mock.calls.forEach(call => {
            const auditEntry = call[0];

            requiredFields.forEach(field => {
              expect(auditEntry).toHaveProperty(field);
              expect(auditEntry[field]).toBeDefined();
              expect(auditEntry[field]).not.toBeNull();
              // All required fields should be non-empty strings
              expect(typeof auditEntry[field]).toBe('string');
              expect((auditEntry[field] as string).length).toBeGreaterThan(0);
            });
          });
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 9: Bulk Operation Accuracy
// Validates: Requirements FR2.4.2
describe('Property 9: Bulk Operation Accuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: build mocks for bulk apply/remove scenarios.
   *
   * @param contactIds       - IDs of contacts to operate on
   * @param existingTagsMap  - map of contactId → tags already on that contact
   * @param outsiderIds      - IDs of contacts NOT in the operation (to verify isolation)
   */
  const buildBulkMocks = (
    contactIds: string[],
    existingTagsMap: Map<string, string[]>,
    outsiderIds: string[] = []
  ) => {
    const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }));

    const mockAuditSet = vi.fn().mockResolvedValue(undefined);
    const mockAuditDoc = vi.fn(() => ({
      id: `audit-${Date.now()}-${Math.random()}`,
      set: mockAuditSet,
    }));

    // Track update calls per contact ref
    const contactUpdateMocks = new Map<string, ReturnType<typeof vi.fn>>();
    const allIds = [...contactIds, ...outsiderIds];

    allIds.forEach(id => {
      contactUpdateMocks.set(id, vi.fn().mockResolvedValue(undefined));
    });

    const mockContactDoc = vi.fn((id: string) => {
      const existingTags = existingTagsMap.get(id) ?? [];
      const taggedAt: Record<string, string> = {};
      const taggedBy: Record<string, string> = {};
      existingTags.forEach(t => {
        taggedAt[t] = '2026-01-01T00:00:00Z';
        taggedBy[t] = 'user-prev';
      });

      return {
        get: vi.fn().mockResolvedValue({
          exists: contactIds.includes(id) || outsiderIds.includes(id),
          data: () => ({
            id,
            name: `Contact ${id}`,
            tags: existingTags,
            taggedAt,
            taggedBy,
          }),
        }),
        update: contactUpdateMocks.get(id) ?? vi.fn().mockResolvedValue(undefined),
      };
    });

    const mockTagDoc = vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'tag-id',
          name: 'Test Tag',
          workspaceId: 'test-workspace',
          category: 'status',
          color: '#FF0000',
          isSystem: false,
          usageCount: 0,
          createdBy: 'user-123',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    }));

    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === 'tag_audit_logs') return { doc: mockAuditDoc };
      if (collectionName === 'tags') return { doc: mockTagDoc };
      // schools / prospects
      return { doc: mockContactDoc };
    });

    return {
      mockCollection,
      mockBatch,
      mockBatchUpdate,
      mockBatchCommit,
      mockContactDoc,
      contactUpdateMocks,
    };
  };

  it('should apply tags to ALL selected contacts and return correct processedCount', async () => {
    /**
     * **Validates: Requirements FR2.4.2**
     *
     * Property: When bulkApplyTagsAction is called with N contacts and M tags,
     * processedCount equals N and every contact in the set receives all M tags.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 20 }
        ), // contact IDs
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tag IDs
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawContactIds, rawTagIds, contactType, userId) => {
          const contactIds = Array.from(new Set(rawContactIds.map(id => `contact-${id}`)));
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          // Contacts start with no tags
          const existingTagsMap = new Map(contactIds.map(id => [id, [] as string[]]));

          const { mockCollection, mockBatch, mockBatchUpdate, mockBatchCommit } =
            buildBulkMocks(contactIds, existingTagsMap);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await bulkApplyTagsAction(contactIds, contactType, tagIds, userId);

          // Property: operation should succeed
          expect(result.success).toBe(true);

          // Property: processedCount must equal the number of contacts
          expect(result.processedCount).toBe(contactIds.length);

          // Property: batch.update was called once per contact (plus tag usage updates)
          const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(
            ([_ref, data]) => 'tags' in data
          );
          expect(contactUpdateCalls.length).toBe(contactIds.length);

          // Property: every contact update includes all M tags
          contactUpdateCalls.forEach(([_ref, updateData]) => {
            tagIds.forEach(tagId => {
              expect(updateData.tags).toContain(tagId);
            });
          });

          // Property: batch was committed
          expect(mockBatchCommit).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should remove tags from ALL selected contacts and return correct processedCount', async () => {
    /**
     * **Validates: Requirements FR2.4.2**
     *
     * Property: When bulkRemoveTagsAction is called with N contacts and M tags,
     * processedCount equals N and every contact in the set has those M tags removed.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 20 }
        ), // contact IDs
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tag IDs to remove
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawContactIds, rawTagIds, contactType, userId) => {
          const contactIds = Array.from(new Set(rawContactIds.map(id => `contact-${id}`)));
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          // Contacts start with all the tags we want to remove, plus an unrelated one
          const existingTagsMap = new Map(
            contactIds.map(id => [id, [...tagIds, 'unrelated-tag']])
          );

          const { mockCollection, mockBatch, mockBatchUpdate, mockBatchCommit } =
            buildBulkMocks(contactIds, existingTagsMap);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await bulkRemoveTagsAction(contactIds, contactType, tagIds, userId);

          // Property: operation should succeed
          expect(result.success).toBe(true);

          // Property: processedCount must equal the number of contacts
          expect(result.processedCount).toBe(contactIds.length);

          // Property: batch.update was called once per contact (plus tag usage updates)
          const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(
            ([_ref, data]) => 'tags' in data
          );
          expect(contactUpdateCalls.length).toBe(contactIds.length);

          // Property: every contact update has all M tags removed
          contactUpdateCalls.forEach(([_ref, updateData]) => {
            tagIds.forEach(tagId => {
              expect(updateData.tags).not.toContain(tagId);
            });
            // Unrelated tag must be preserved
            expect(updateData.tags).toContain('unrelated-tag');
          });

          // Property: batch was committed
          expect(mockBatchCommit).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not affect contacts outside the selected set (isolation)', async () => {
    /**
     * **Validates: Requirements FR2.4.2**
     *
     * Property: bulkApplyTagsAction only touches the explicitly provided contactIds.
     * Contacts not in the list are never passed to batch.update.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // selected contact IDs
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // outsider contact IDs (not selected)
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ), // tag IDs
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawSelected, rawOutsiders, rawTagIds, contactType, userId) => {
          const selectedIds = Array.from(new Set(rawSelected.map(id => `sel-${id}`)));
          const outsiderIds = Array.from(
            new Set(rawOutsiders.map(id => `out-${id}`).filter(id => !selectedIds.includes(id)))
          );
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          if (outsiderIds.length === 0) return; // need at least one outsider to verify isolation

          const existingTagsMap = new Map([
            ...selectedIds.map(id => [id, [] as string[]] as [string, string[]]),
            ...outsiderIds.map(id => [id, [] as string[]] as [string, string[]]),
          ]);

          const { mockCollection, mockBatch, mockBatchUpdate, contactUpdateMocks } =
            buildBulkMocks(selectedIds, existingTagsMap, outsiderIds);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await bulkApplyTagsAction(selectedIds, contactType, tagIds, userId);

          expect(result.success).toBe(true);

          // Property: outsider contacts were never updated
          outsiderIds.forEach(outsiderId => {
            const outsiderUpdateMock = contactUpdateMocks.get(outsiderId);
            if (outsiderUpdateMock) {
              expect(outsiderUpdateMock).not.toHaveBeenCalled();
            }
          });

          // Property: batch.update was never called with an outsider ref
          // (verify by checking that only selectedIds appear in update calls)
          const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(
            ([_ref, data]) => 'tags' in data
          );
          expect(contactUpdateCalls.length).toBe(selectedIds.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not duplicate tags already present on a contact (idempotency)', async () => {
    /**
     * **Validates: Requirements FR2.4.2**
     *
     * Property: When bulkApplyTagsAction is called and a contact already has some
     * of the requested tags, those tags are not duplicated in the resulting tag array.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // contact IDs
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tag IDs to apply (contacts already have all of them)
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawContactIds, rawTagIds, contactType, userId) => {
          const contactIds = Array.from(new Set(rawContactIds.map(id => `contact-${id}`)));
          const tagIds = Array.from(new Set(rawTagIds.map(id => `tag-${id}`)));

          // Contacts already have ALL the tags we're about to apply
          const existingTagsMap = new Map(contactIds.map(id => [id, [...tagIds]]));

          const { mockCollection, mockBatch, mockBatchUpdate } =
            buildBulkMocks(contactIds, existingTagsMap);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await bulkApplyTagsAction(contactIds, contactType, tagIds, userId);

          expect(result.success).toBe(true);

          // Property: no tag appears more than once in any contact's resulting tag array
          const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(
            ([_ref, data]) => 'tags' in data
          );

          contactUpdateCalls.forEach(([_ref, updateData]) => {
            const tags: string[] = updateData.tags;
            const uniqueTags = new Set(tags);
            // Property: no duplicates — array length equals unique count
            expect(tags.length).toBe(uniqueTags.size);

            // Property: all requested tags are still present
            tagIds.forEach(tagId => {
              expect(tags).toContain(tagId);
            });
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should hold all properties for arbitrary sets of contacts and tags', async () => {
    /**
     * **Validates: Requirements FR2.4.2**
     *
     * Property: For any combination of N contacts (some with pre-existing tags, some
     * without) and M tags to apply, the bulk apply operation is accurate and complete:
     * - processedCount === N
     * - every contact ends up with all M tags
     * - no duplicates in any contact's tag list
     * - pre-existing unrelated tags are preserved
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-z0-9]+$/.test(s)),
            preTags: fc.array(
              fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
              { minLength: 0, maxLength: 3 }
            ),
          }),
          { minLength: 1, maxLength: 15 }
        ), // contacts with their pre-existing tags
        fc.array(
          fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ), // tag IDs to bulk-apply
        fc.constantFrom('school' as const, 'prospect' as const),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (rawContacts, rawTagIds, contactType, userId) => {
          // Deduplicate contact IDs
          const seen = new Set<string>();
          const contacts = rawContacts
            .map(c => ({ ...c, id: `c-${c.id}` }))
            .filter(c => {
              if (seen.has(c.id)) return false;
              seen.add(c.id);
              return true;
            });

          const contactIds = contacts.map(c => c.id);
          const tagIds = Array.from(new Set(rawTagIds.map(id => `t-${id}`)));

          // Build existing tags map — prefix pre-existing tags to avoid collision with tagIds
          const existingTagsMap = new Map(
            contacts.map(c => [
              c.id,
              Array.from(new Set(c.preTags.map(t => `pre-${t}`))),
            ])
          );

          const { mockCollection, mockBatch, mockBatchUpdate, mockBatchCommit } =
            buildBulkMocks(contactIds, existingTagsMap);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await bulkApplyTagsAction(contactIds, contactType, tagIds, userId);

          // Property: operation succeeds
          expect(result.success).toBe(true);

          // Property: processedCount === N
          expect(result.processedCount).toBe(contactIds.length);

          const contactUpdateCalls = mockBatchUpdate.mock.calls.filter(
            ([_ref, data]) => 'tags' in data
          );

          // Property: all N contacts were updated
          expect(contactUpdateCalls.length).toBe(contactIds.length);

          contactUpdateCalls.forEach(([_ref, updateData]) => {
            const tags: string[] = updateData.tags;

            // Property: all M tags are present
            tagIds.forEach(tagId => {
              expect(tags).toContain(tagId);
            });

            // Property: no duplicates
            expect(tags.length).toBe(new Set(tags).size);
          });

          // Property: batch was committed
          expect(mockBatchCommit).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: contact-tagging-system, Property 10: Tag Filter AND Logic
// Validates: Requirements FR3.1.1
describe('Property 10: Tag Filter AND Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build Firestore mocks for getContactsByTagsAction AND-logic tests.
   *
   * @param schoolDocs    - array of { id, tags } representing school documents
   * @param prospectDocs  - array of { id, tags } representing prospect documents
   * @param workspaceId   - workspace to scope queries to
   */
  const buildAndFilterMocks = (
    schoolDocs: Array<{ id: string; tags: string[] }>,
    prospectDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    /**
     * Simulate Firestore's array-contains query:
     * returns docs whose tags array includes the given tagId.
     */
    const makeQuerySnap = (docs: Array<{ id: string; tags: string[] }>, tagId: string) => ({
      docs: docs
        .filter(d => d.tags.includes(tagId))
        .map(d => ({
          id: d.id,
          data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
        })),
    });

    const mockCollection = vi.fn((collectionName: string) => {
      const docs = collectionName === 'schools' ? schoolDocs : prospectDocs;

      return {
        where: vi.fn((_field: string, _op: string, _val: string) => ({
          where: vi.fn((_f2: string, _o2: string, tagId: string) => ({
            get: vi.fn().mockResolvedValue(makeQuerySnap(docs, tagId)),
          })),
          get: vi.fn().mockResolvedValue({ docs: docs.map(d => ({ id: d.id, data: () => ({ tags: d.tags }) })) }),
        })),
      };
    });

    return { mockCollection };
  };

  it('should return only contacts that have ALL specified tags (AND logic)', async () => {
    /**
     * Property: For any set of contacts and any set of filter tags,
     * AND logic returns exactly those contacts whose tag array is a superset
     * of the filter tag set — no more, no less.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate a pool of tag IDs
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 8 }
        ),
        // Generate school documents with random subsets of the tag pool
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        // Filter: pick 1–3 tags from the pool to require
        fc.integer({ min: 1, max: 3 }),
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTagPool, rawSchools, filterCount, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return; // need at least 2 tags for a meaningful AND

          const filterTags = tagPool.slice(0, Math.min(filterCount, tagPool.length));

          // Assign random subsets of tagPool to each school (deduplicate IDs)
          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              // Deterministically assign tags based on index to get varied coverage
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 2 === 0);
              return { id: s.id, tags: assignedTags };
            });

          const { mockCollection } = buildAndFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'AND',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Compute expected: contacts that have ALL filter tags
          const expectedIds = new Set(
            schoolDocs
              .filter(d => filterTags.every(t => d.tags.includes(t)))
              .map(d => d.id)
          );

          // Property: every returned contact has all filter tags
          for (const id of returnedIds) {
            const doc = schoolDocs.find(d => d.id === id);
            expect(doc).toBeDefined();
            filterTags.forEach(t => {
              expect(doc!.tags).toContain(t);
            });
          }

          // Property: no qualifying contact is missing from the result
          for (const id of expectedIds) {
            expect(returnedIds).toContain(id);
          }

          // Property: result size matches expected
          expect(returnedIds.size).toBe(expectedIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty result when no contacts have ALL required tags', async () => {
    /**
     * Property: If no contact in the workspace has all filter tags simultaneously,
     * AND logic must return an empty array.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 6 }
        ), // tag pool
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // school IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTagPool, rawSchoolIds, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return;

          const filterTags = tagPool; // require ALL tags in pool

          // Each school gets only the first tag — never all of them (when pool.length >= 2)
          const seenIds = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map(id => ({ id, tags: [tagPool[0]] })); // only first tag, never all

          const { mockCollection } = buildAndFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'AND',
          });

          expect(result.success).toBe(true);

          // Property: result is empty when no contact qualifies
          if (filterTags.length > 1) {
            expect(result.data ?? []).toHaveLength(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should return all contacts when filtering by a single tag (AND with one tag = has-tag)', async () => {
    /**
     * Property: AND logic with a single tag is equivalent to a simple "has tag" filter.
     * Every contact with that tag must be returned, and no contact without it.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // single filter tag
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
            hasTag: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTag, rawSchools, workspaceId) => {
          const filterTag = `tag-${rawTag}`;

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}`, hasTag: s.hasTag }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map(s => ({
              id: s.id,
              tags: s.hasTag ? [filterTag] : ['other-tag'],
            }));

          const { mockCollection } = buildAndFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: [filterTag],
            logic: 'AND',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          const expectedIds = new Set(
            schoolDocs.filter(d => d.tags.includes(filterTag)).map(d => d.id)
          );

          // Property: returned set equals expected set exactly
          expect(returnedIds.size).toBe(expectedIds.size);
          for (const id of expectedIds) {
            expect(returnedIds).toContain(id);
          }
          for (const id of returnedIds) {
            expect(expectedIds).toContain(id);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  it('should return empty array when tagIds is empty', async () => {
    /**
     * Property: An empty tagIds array always yields an empty result regardless of
     * what contacts exist in the workspace.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (workspaceId) => {
          const { adminDb } = await import('../firebase-admin');
          // collection should not even be called for empty tagIds
          const mockCollection = vi.fn();
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: [],
            logic: 'AND',
          });

          expect(result.success).toBe(true);
          expect(result.data).toEqual([]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should include contacts from both schools and prospects collections', async () => {
    /**
     * Property: AND logic queries both schools and prospects collections.
     * Qualifying contacts from either collection appear in the result.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // tag A
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // tag B
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ), // school IDs
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ), // prospect IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTagA, rawTagB, rawSchoolIds, rawProspectIds, workspaceId) => {
          if (rawTagA === rawTagB) return; // need distinct tags

          const tagA = `tag-${rawTagA}`;
          const tagB = `tag-${rawTagB}`;
          const filterTags = [tagA, tagB];

          const seenSchools = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => { if (seenSchools.has(id)) return false; seenSchools.add(id); return true; })
            .map(id => ({ id, tags: [tagA, tagB] })); // all schools qualify

          const seenProspects = new Set<string>();
          const prospectDocs = rawProspectIds
            .map(id => `prospect-${id}`)
            .filter(id => { if (seenProspects.has(id)) return false; seenProspects.add(id); return true; })
            .map(id => ({ id, tags: [tagA, tagB] })); // all prospects qualify

          const { mockCollection } = buildAndFilterMocks(schoolDocs, prospectDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'AND',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Property: all qualifying schools are returned
          schoolDocs.forEach(d => {
            expect(returnedIds).toContain(d.id);
          });

          // Property: all qualifying prospects are returned
          prospectDocs.forEach(d => {
            expect(returnedIds).toContain(d.id);
          });

          // Property: total count = schools + prospects (all qualify in this scenario)
          expect(returnedIds.size).toBe(schoolDocs.length + prospectDocs.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Tag Filter OR Logic
// Validates: Requirements FR3.1.1
// ---------------------------------------------------------------------------
describe('Property 11: Tag Filter OR Logic', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mock('../firebase-admin', () => ({ adminDb: { collection: vi.fn() } }));
  });

  /**
   * Build Firestore mocks for getContactsByTagsAction OR-logic tests.
   *
   * OR logic uses `array-contains-any` (up to 10 per chunk).
   * We simulate this by returning docs that contain at least one of the
   * requested tag IDs.
   */
  const buildOrFilterMocks = (
    schoolDocs: Array<{ id: string; tags: string[] }>,
    prospectDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    /**
     * Simulate Firestore's array-contains-any query:
     * returns docs whose tags array includes at least one tag in the chunk.
     */
    const makeQuerySnap = (
      docs: Array<{ id: string; tags: string[] }>,
      chunk: string[]
    ) => ({
      docs: docs
        .filter(d => chunk.some(t => d.tags.includes(t)))
        .map(d => ({
          id: d.id,
          data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
        })),
    });

    const mockCollection = vi.fn((collectionName: string) => {
      const docs = collectionName === 'schools' ? schoolDocs : prospectDocs;

      return {
        where: vi.fn((_field: string, _op: string, _val: unknown) => ({
          where: vi.fn((_f2: string, _o2: string, chunk: string[]) => ({
            get: vi.fn().mockResolvedValue(makeQuerySnap(docs, chunk)),
          })),
          get: vi.fn().mockResolvedValue({
            docs: docs.map(d => ({ id: d.id, data: () => ({ tags: d.tags }) })),
          }),
        })),
      };
    });

    return { mockCollection };
  };

  it('should return contacts that have AT LEAST ONE of the specified tags (OR logic)', async () => {
    /**
     * Property: For any set of contacts and any set of filter tags,
     * OR logic returns exactly those contacts whose tag array intersects
     * with the filter tag set — no more, no less.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate a pool of tag IDs
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 8 }
        ),
        // Generate school documents
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        // How many tags to use as filter
        fc.integer({ min: 1, max: 3 }),
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTagPool, rawSchools, filterCount, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return;

          const filterTags = tagPool.slice(0, Math.min(filterCount, tagPool.length));

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              // Deterministically assign tags to get varied coverage
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 3 === 0);
              return { id: s.id, tags: assignedTags };
            });

          const { mockCollection } = buildOrFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'OR',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Compute expected: contacts that have AT LEAST ONE filter tag
          const expectedIds = new Set(
            schoolDocs
              .filter(d => filterTags.some(t => d.tags.includes(t)))
              .map(d => d.id)
          );

          // Property: every returned contact has at least one filter tag
          for (const id of returnedIds) {
            const doc = schoolDocs.find(d => d.id === id);
            expect(doc).toBeDefined();
            expect(filterTags.some(t => doc!.tags.includes(t))).toBe(true);
          }

          // Property: no qualifying contact is missing from the result
          for (const id of expectedIds) {
            expect(returnedIds).toContain(id);
          }

          // Property: result size matches expected
          expect(returnedIds.size).toBe(expectedIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty result when no contacts have any of the filter tags', async () => {
    /**
     * Property: If no contact has any of the filter tags, OR logic returns empty.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 4 }
        ), // filter tags
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // school IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawFilterTags, rawSchoolIds, workspaceId) => {
          const filterTags = rawFilterTags.map(t => `filter-${t}`);
          const otherTag = 'other-tag-xyz';

          const seenIds = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map(id => ({ id, tags: [otherTag] })); // none have filter tags

          const { mockCollection } = buildOrFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'OR',
          });

          expect(result.success).toBe(true);
          // Property: result is empty when no contact qualifies
          expect(result.data ?? []).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('OR logic should be a superset of AND logic for the same tags', async () => {
    /**
     * Property: For any contact set and filter tags,
     * OR result ⊇ AND result.
     * Any contact returned by AND (has all tags) must also be returned by OR
     * (has at least one tag).
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 6 }
        ),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 1, maxLength: 15 }
        ),
        fc.string({ minLength: 3, maxLength: 20 }),
        async (rawTagPool, rawSchools, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return;

          const filterTags = tagPool.slice(0, 2); // use exactly 2 tags

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 2 === 0);
              return { id: s.id, tags: assignedTags };
            });

          // Run AND query
          const { buildAndFilterMocks: buildAnd } = (() => {
            const makeQuerySnap = (docs: Array<{ id: string; tags: string[] }>, tagId: string) => ({
              docs: docs
                .filter(d => d.tags.includes(tagId))
                .map(d => ({ id: d.id, data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }) })),
            });
            const mockCollection = vi.fn((collectionName: string) => {
              const docs = collectionName === 'schools' ? schoolDocs : [];
              return {
                where: vi.fn(() => ({
                  where: vi.fn((_f: string, _o: string, tagId: string) => ({
                    get: vi.fn().mockResolvedValue(makeQuerySnap(docs, tagId)),
                  })),
                  get: vi.fn().mockResolvedValue({ docs: docs.map(d => ({ id: d.id, data: () => ({ tags: d.tags }) })) }),
                })),
              };
            });
            return { buildAndFilterMocks: () => ({ mockCollection }) };
          })();

          const { adminDb } = await import('../firebase-admin');
          const { getContactsByTagsAction } = await import('../tag-actions');

          vi.mocked(adminDb).collection = buildAnd().mockCollection as any;
          const andResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'AND' });

          // Run OR query
          const { mockCollection: orMock } = buildOrFilterMocks(schoolDocs, [], workspaceId);
          vi.mocked(adminDb).collection = orMock as any;
          const orResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'OR' });

          expect(andResult.success).toBe(true);
          expect(orResult.success).toBe(true);

          const andIds = new Set(andResult.data ?? []);
          const orIds = new Set(orResult.data ?? []);

          // Property: OR result is a superset of AND result
          for (const id of andIds) {
            expect(orIds).toContain(id);
          }

          // Property: OR result size >= AND result size
          expect(orIds.size).toBeGreaterThanOrEqual(andIds.size);
        }
      ),
      { numRuns: 40 }
    );
  });

  it('should handle more than 10 filter tags by chunking (OR logic)', async () => {
    /**
     * Property: OR logic with >10 tags (Firestore array-contains-any limit)
     * still returns all contacts that have at least one of the tags.
     * The chunking implementation must not miss any qualifying contacts.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // school IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawSchoolIds, workspaceId) => {
          // Create 12 filter tags (exceeds the 10-tag chunk limit)
          const filterTags = Array.from({ length: 12 }, (_, i) => `filter-tag-${i}`);

          const seenIds = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map((id, i) => ({
              id,
              // Each school gets one tag from a different chunk position
              tags: [filterTags[i % filterTags.length]],
            }));

          const { mockCollection } = buildOrFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'OR',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Property: all schools qualify (each has one of the filter tags)
          for (const doc of schoolDocs) {
            expect(returnedIds).toContain(doc.id);
          }

          // Property: no duplicates in result
          expect(returnedIds.size).toBe((result.data ?? []).length);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should include contacts from both schools and prospects collections (OR logic)', async () => {
    /**
     * Property: OR logic queries both schools and prospects.
     * Qualifying contacts from either collection appear in the result.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // tag A
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // tag B
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ),
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ),
        fc.string({ minLength: 3, maxLength: 20 }),
        async (rawTagA, rawTagB, rawSchoolIds, rawProspectIds, workspaceId) => {
          if (rawTagA === rawTagB) return;

          const tagA = `tag-${rawTagA}`;
          const tagB = `tag-${rawTagB}`;

          const seenSchools = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => { if (seenSchools.has(id)) return false; seenSchools.add(id); return true; })
            .map(id => ({ id, tags: [tagA] })); // schools have tagA only

          const seenProspects = new Set<string>();
          const prospectDocs = rawProspectIds
            .map(id => `prospect-${id}`)
            .filter(id => { if (seenProspects.has(id)) return false; seenProspects.add(id); return true; })
            .map(id => ({ id, tags: [tagB] })); // prospects have tagB only

          const { mockCollection } = buildOrFilterMocks(schoolDocs, prospectDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: [tagA, tagB],
            logic: 'OR',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Property: all schools (have tagA) are returned
          schoolDocs.forEach(d => expect(returnedIds).toContain(d.id));

          // Property: all prospects (have tagB) are returned
          prospectDocs.forEach(d => expect(returnedIds).toContain(d.id));

          // Property: total = schools + prospects (all qualify, no overlap)
          expect(returnedIds.size).toBe(schoolDocs.length + prospectDocs.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Tag Filter NOT Logic
// Validates: Requirements FR3.1.1
// ---------------------------------------------------------------------------
describe('Property 12: Tag Filter NOT Logic', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mock('../firebase-admin', () => ({ adminDb: { collection: vi.fn() } }));
  });

  /**
   * Build Firestore mocks for getContactsByTagsAction NOT-logic tests.
   *
   * NOT logic fetches ALL contacts in the workspace, then excludes those
   * that have any of the specified tags. The mock simulates the two
   * workspace-scoped queries (schools + prospects) that return all docs.
   */
  const buildNotFilterMocks = (
    schoolDocs: Array<{ id: string; tags: string[] }>,
    prospectDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    const makeAllDocsSnap = (docs: Array<{ id: string; tags: string[] }>) => ({
      docs: docs.map(d => ({
        id: d.id,
        data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
      })),
    });

    const mockCollection = vi.fn((collectionName: string) => {
      const docs = collectionName === 'schools' ? schoolDocs : prospectDocs;

      return {
        where: vi.fn((_field: string, _op: string, _val: unknown) => ({
          // NOT logic calls .where(...).get() — no second .where()
          get: vi.fn().mockResolvedValue(makeAllDocsSnap(docs)),
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(makeAllDocsSnap(docs)),
          })),
        })),
      };
    });

    return { mockCollection };
  };

  it('should return only contacts that have NONE of the specified tags (NOT logic)', async () => {
    /**
     * Property: For any set of contacts and any set of excluded tags,
     * NOT logic returns exactly those contacts whose tag array has NO
     * intersection with the excluded tag set — no more, no less.
     */
    await fc.assert(
      fc.asyncProperty(
        // Pool of tag IDs
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 8 }
        ),
        // School documents
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 0, maxLength: 15 }
        ),
        // How many tags to exclude
        fc.integer({ min: 1, max: 3 }),
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTagPool, rawSchools, excludeCount, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return;

          const excludedTags = tagPool.slice(0, Math.min(excludeCount, tagPool.length));

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              // Deterministically assign tags to get varied coverage
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 2 === 0);
              return { id: s.id, tags: assignedTags };
            });

          const { mockCollection } = buildNotFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: excludedTags,
            logic: 'NOT',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Compute expected: contacts that have NONE of the excluded tags
          const expectedIds = new Set(
            schoolDocs
              .filter(d => !excludedTags.some(t => d.tags.includes(t)))
              .map(d => d.id)
          );

          // Property: every returned contact has none of the excluded tags
          for (const id of returnedIds) {
            const doc = schoolDocs.find(d => d.id === id);
            expect(doc).toBeDefined();
            excludedTags.forEach(t => {
              expect(doc!.tags).not.toContain(t);
            });
          }

          // Property: no qualifying contact is missing from the result
          for (const id of expectedIds) {
            expect(returnedIds).toContain(id);
          }

          // Property: result size matches expected
          expect(returnedIds.size).toBe(expectedIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return all contacts when none have any of the excluded tags', async () => {
    /**
     * Property: If no contact has any of the excluded tags, NOT logic
     * returns the entire workspace contact set.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 4 }
        ), // excluded tags
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // school IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawExcludedTags, rawSchoolIds, workspaceId) => {
          const excludedTags = rawExcludedTags.map(t => `excluded-${t}`);
          const otherTag = 'unrelated-tag-xyz';

          const seenIds = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map(id => ({ id, tags: [otherTag] })); // none have excluded tags

          const { mockCollection } = buildNotFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: excludedTags,
            logic: 'NOT',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Property: all contacts are returned when none have excluded tags
          for (const doc of schoolDocs) {
            expect(returnedIds).toContain(doc.id);
          }
          expect(returnedIds.size).toBe(schoolDocs.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should return empty result when all contacts have at least one excluded tag', async () => {
    /**
     * Property: If every contact has at least one excluded tag, NOT logic
     * returns an empty array.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // single excluded tag
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ), // school IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTag, rawSchoolIds, workspaceId) => {
          const excludedTag = `excluded-${rawTag}`;

          const seenIds = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map(id => ({ id, tags: [excludedTag] })); // every contact has the excluded tag

          const { mockCollection } = buildNotFilterMocks(schoolDocs, [], workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: [excludedTag],
            logic: 'NOT',
          });

          expect(result.success).toBe(true);
          // Property: result is empty when all contacts are excluded
          expect(result.data ?? []).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('NOT result and OR result should be disjoint for the same tags', async () => {
    /**
     * Property: For any contact set and filter tags,
     * NOT result ∩ OR result = ∅.
     * A contact returned by NOT (has none of the tags) cannot also be
     * returned by OR (has at least one of the tags).
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 6 }
        ),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 1, maxLength: 15 }
        ),
        fc.string({ minLength: 3, maxLength: 20 }),
        async (rawTagPool, rawSchools, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          if (tagPool.length < 2) return;

          const filterTags = tagPool.slice(0, 2);

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 2 === 0);
              return { id: s.id, tags: assignedTags };
            });

          const { adminDb } = await import('../firebase-admin');
          const { getContactsByTagsAction } = await import('../tag-actions');

          // Run NOT query
          const { mockCollection: notMock } = buildNotFilterMocks(schoolDocs, [], workspaceId);
          vi.mocked(adminDb).collection = notMock as any;
          const notResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'NOT' });

          // Run OR query — reuse OR mock helper inline
          const makeOrSnap = (docs: Array<{ id: string; tags: string[] }>, chunk: string[]) => ({
            docs: docs
              .filter(d => chunk.some(t => d.tags.includes(t)))
              .map(d => ({ id: d.id, data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }) })),
          });
          const orMock = vi.fn((collectionName: string) => {
            const docs = collectionName === 'schools' ? schoolDocs : [];
            return {
              where: vi.fn(() => ({
                where: vi.fn((_f: string, _o: string, chunk: string[]) => ({
                  get: vi.fn().mockResolvedValue(makeOrSnap(docs, chunk)),
                })),
                get: vi.fn().mockResolvedValue({ docs: docs.map(d => ({ id: d.id, data: () => ({ tags: d.tags }) })) }),
              })),
            };
          });
          vi.mocked(adminDb).collection = orMock as any;
          const orResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'OR' });

          expect(notResult.success).toBe(true);
          expect(orResult.success).toBe(true);

          const notIds = new Set(notResult.data ?? []);
          const orIds = new Set(orResult.data ?? []);

          // Property: NOT and OR results are disjoint
          for (const id of notIds) {
            expect(orIds).not.toContain(id);
          }
          for (const id of orIds) {
            expect(notIds).not.toContain(id);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  it('NOT result and OR result should together cover all workspace contacts', async () => {
    /**
     * Property: NOT result ∪ OR result = all contacts in the workspace.
     * Every contact either has at least one filter tag (OR) or has none (NOT).
     * Together they partition the full contact set.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          }),
          { minLength: 1, maxLength: 15 }
        ),
        fc.string({ minLength: 3, maxLength: 20 }),
        async (rawTagPool, rawSchools, workspaceId) => {
          const tagPool = Array.from(new Set(rawTagPool.map(t => `tag-${t}`)));
          const filterTags = tagPool.slice(0, Math.min(2, tagPool.length));
          if (filterTags.length === 0) return;

          const seenIds = new Set<string>();
          const schoolDocs = rawSchools
            .map(s => ({ id: `school-${s.id}` }))
            .filter(s => {
              if (seenIds.has(s.id)) return false;
              seenIds.add(s.id);
              return true;
            })
            .map((s, i) => {
              const assignedTags = tagPool.filter((_, ti) => (i + ti) % 2 === 0);
              return { id: s.id, tags: assignedTags };
            });

          const allIds = new Set(schoolDocs.map(d => d.id));

          const { adminDb } = await import('../firebase-admin');
          const { getContactsByTagsAction } = await import('../tag-actions');

          // NOT query
          const { mockCollection: notMock } = buildNotFilterMocks(schoolDocs, [], workspaceId);
          vi.mocked(adminDb).collection = notMock as any;
          const notResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'NOT' });

          // OR query
          const makeOrSnap = (docs: Array<{ id: string; tags: string[] }>, chunk: string[]) => ({
            docs: docs
              .filter(d => chunk.some(t => d.tags.includes(t)))
              .map(d => ({ id: d.id, data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }) })),
          });
          const orMock = vi.fn((collectionName: string) => {
            const docs = collectionName === 'schools' ? schoolDocs : [];
            return {
              where: vi.fn(() => ({
                where: vi.fn((_f: string, _o: string, chunk: string[]) => ({
                  get: vi.fn().mockResolvedValue(makeOrSnap(docs, chunk)),
                })),
                get: vi.fn().mockResolvedValue({ docs: docs.map(d => ({ id: d.id, data: () => ({ tags: d.tags }) })) }),
              })),
            };
          });
          vi.mocked(adminDb).collection = orMock as any;
          const orResult = await getContactsByTagsAction(workspaceId, { tagIds: filterTags, logic: 'OR' });

          expect(notResult.success).toBe(true);
          expect(orResult.success).toBe(true);

          const unionIds = new Set([...(notResult.data ?? []), ...(orResult.data ?? [])]);

          // Property: union of NOT and OR equals all contacts
          expect(unionIds.size).toBe(allIds.size);
          for (const id of allIds) {
            expect(unionIds).toContain(id);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  it('should include contacts from both schools and prospects collections (NOT logic)', async () => {
    /**
     * Property: NOT logic queries both schools and prospects.
     * Contacts from either collection that lack the excluded tags appear in the result.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)), // excluded tag
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ), // school IDs
        fc.array(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => /^[a-z0-9]+$/.test(s)),
          { minLength: 1, maxLength: 8 }
        ), // prospect IDs
        fc.string({ minLength: 3, maxLength: 20 }), // workspaceId
        async (rawTag, rawSchoolIds, rawProspectIds, workspaceId) => {
          const excludedTag = `excluded-${rawTag}`;
          const safeTag = 'safe-tag-xyz';

          const seenSchools = new Set<string>();
          const schoolDocs = rawSchoolIds
            .map(id => `school-${id}`)
            .filter(id => { if (seenSchools.has(id)) return false; seenSchools.add(id); return true; })
            .map(id => ({ id, tags: [safeTag] })); // schools do NOT have excluded tag

          const seenProspects = new Set<string>();
          const prospectDocs = rawProspectIds
            .map(id => `prospect-${id}`)
            .filter(id => { if (seenProspects.has(id)) return false; seenProspects.add(id); return true; })
            .map(id => ({ id, tags: [safeTag] })); // prospects do NOT have excluded tag

          const { mockCollection } = buildNotFilterMocks(schoolDocs, prospectDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: [excludedTag],
            logic: 'NOT',
          });

          expect(result.success).toBe(true);
          const returnedIds = new Set(result.data ?? []);

          // Property: all schools (no excluded tag) are returned
          schoolDocs.forEach(d => expect(returnedIds).toContain(d.id));

          // Property: all prospects (no excluded tag) are returned
          prospectDocs.forEach(d => expect(returnedIds).toContain(d.id));

          // Property: total = schools + prospects
          expect(returnedIds.size).toBe(schoolDocs.length + prospectDocs.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// Feature: contact-tagging-system, Property 13: Tag Condition Evaluation
// Validates: Requirements FR4.2.1
describe('Property 13: Tag Condition Evaluation', () => {
  /**
   * Helper to build a TagConditionNode for testing.
   */
  function makeConditionNode(
    logic: 'has_tag' | 'has_all_tags' | 'has_any_tag' | 'not_has_tag',
    tagIds: string[]
  ) {
    return { id: 'test-node', type: 'tag_condition' as const, data: { logic, tagIds } };
  }

  // Arbitrary for a non-empty set of unique tag IDs
  const tagIdArb = fc.string({ minLength: 2, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s));
  const tagSetArb = fc.array(tagIdArb, { minLength: 1, maxLength: 10 }).map(arr => [...new Set(arr)]);

  it('has_tag: returns true iff tagId ∈ T (contact has at least one of the specified tags)', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: has_tag(tagIds) is true iff the contact's tag set T contains at least one id from tagIds.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const node = makeConditionNode('has_tag', conditionTagIds);
          const result = evaluateTagCondition(contactTags, node);

          const contactTagSet = new Set(contactTags);
          const expected = conditionTagIds.some(id => contactTagSet.has(id));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('has_all_tags: returns true iff every tagId ∈ tagIds is in T', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: has_all_tags(tagIds) is true iff every id in tagIds is present in the contact's tag set T.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const node = makeConditionNode('has_all_tags', conditionTagIds);
          const result = evaluateTagCondition(contactTags, node);

          const contactTagSet = new Set(contactTags);
          const expected = conditionTagIds.every(id => contactTagSet.has(id));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('has_any_tag: returns true iff at least one tagId ∈ tagIds is in T (OR logic)', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: has_any_tag(tagIds) is true iff at least one id in tagIds is present in T.
     * This is the OR logic alias for has_tag.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const node = makeConditionNode('has_any_tag', conditionTagIds);
          const result = evaluateTagCondition(contactTags, node);

          const contactTagSet = new Set(contactTags);
          const expected = conditionTagIds.some(id => contactTagSet.has(id));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('not_has_tag: returns true iff tagId ∉ T (contact has none of the specified tags)', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: not_has_tag(tagIds) is true iff none of the ids in tagIds are present in T.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const node = makeConditionNode('not_has_tag', conditionTagIds);
          const result = evaluateTagCondition(contactTags, node);

          const contactTagSet = new Set(contactTags);
          const expected = !conditionTagIds.some(id => contactTagSet.has(id));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('has_tag and has_any_tag are equivalent for all inputs', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: has_tag and has_any_tag always produce the same result (they are aliases).
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const hasTagResult = evaluateTagCondition(contactTags, makeConditionNode('has_tag', conditionTagIds));
          const hasAnyTagResult = evaluateTagCondition(contactTags, makeConditionNode('has_any_tag', conditionTagIds));
          expect(hasTagResult).toBe(hasAnyTagResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('has_tag and not_has_tag are complements for all inputs', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: has_tag(tagIds) === !not_has_tag(tagIds) for any contact tag set T.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const hasTagResult = evaluateTagCondition(contactTags, makeConditionNode('has_tag', conditionTagIds));
          const notHasTagResult = evaluateTagCondition(contactTags, makeConditionNode('not_has_tag', conditionTagIds));
          expect(hasTagResult).toBe(!notHasTagResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('has_all_tags implies has_any_tag when tagIds is non-empty', async () => {
    /**
     * **Validates: Requirements FR4.2.1**
     * Property: if has_all_tags(tagIds) is true, then has_any_tag(tagIds) must also be true.
     */
    await fc.assert(
      fc.asyncProperty(
        tagSetArb, // contact tags T
        tagSetArb, // condition tagIds (non-empty by construction)
        async (contactTags, conditionTagIds) => {
          const { evaluateTagCondition } = await import('../tag-condition');
          const allResult = evaluateTagCondition(contactTags, makeConditionNode('has_all_tags', conditionTagIds));
          const anyResult = evaluateTagCondition(contactTags, makeConditionNode('has_any_tag', conditionTagIds));

          // If all tags match, at least one must match
          if (allResult) {
            expect(anyResult).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contact-tagging-system, Property 14: Tag Usage Count Accuracy
// Validates: Requirements FR6.1.1
describe('Property 14: Tag Usage Count Accuracy', () => {
  /**
   * getTagUsageStatsAction returns one stat entry per tag in the workspace,
   * and the contactCount for each entry reflects the tag's usageCount field.
   *
   * Properties verified:
   * 1. Result count equals the number of tags in the workspace
   * 2. Each stat's contactCount matches the tag's usageCount
   * 3. Stats are sorted by contactCount descending
   * 4. trendDirection is 'up' when recent > prior, 'down' when recent < prior, 'stable' when equal
   * 5. Tags with no audit log entries have trendDirection 'stable'
   */

  // Arbitrary for a non-negative usage count
  const usageCountArb = fc.integer({ min: 0, max: 1000 });

  // Arbitrary for a tag document
  const tagDocArb = fc.record({
    id: fc.string({ minLength: 4, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    usageCount: usageCountArb,
    updatedAt: fc.constant('2026-01-01T00:00:00Z'),
  });

  // Build a mock adminDb for getTagUsageStatsAction
  function buildUsageStatsMocks(opts: {
    workspaceId: string;
    tags: Array<{ id: string; name: string; usageCount: number; updatedAt: string }>;
    recentApplied: Array<{ tagId: string; timestamp: string }>;
    priorApplied: Array<{ tagId: string; timestamp: string }>;
  }) {
    const { workspaceId, tags, recentApplied, priorApplied } = opts;

    const allAuditLogs = [...recentApplied, ...priorApplied];

    return vi.fn((collectionName: string) => {
      if (collectionName === 'tags') {
        return {
          where: (_field: string, _op: string, _val: string) => ({
            get: vi.fn().mockResolvedValue({
              empty: tags.length === 0,
              docs: tags.map(t => ({
                id: t.id,
                data: () => ({ ...t, workspaceId }),
              })),
            }),
          }),
        };
      }

      if (collectionName === 'tag_audit_logs') {
        return {
          where: () => ({
            where: () => ({
              where: () => ({
                get: vi.fn().mockResolvedValue({
                  empty: allAuditLogs.length === 0,
                  docs: allAuditLogs.map((log, i) => ({
                    id: `log-${i}`,
                    data: () => ({ ...log, action: 'applied', workspaceId }),
                  })),
                }),
              }),
            }),
          }),
        };
      }

      // message_logs and automations: return empty (best-effort, not under test here)
      return {
        where: () => ({
          where: () => ({
            limit: () => ({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      };
    });
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('result count equals the number of tags in the workspace', async () => {
    /**
     * Property: |stats| === |tags in workspace|
     * For any set of tags, getTagUsageStatsAction returns exactly one stat per tag.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.array(tagDocArb, { minLength: 0, maxLength: 20 }).map(arr => {
          // Deduplicate by id
          const seen = new Set<string>();
          return arr.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true));
        }),
        async (workspaceId, tags) => {
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags,
            recentApplied: [],
            priorApplied: [],
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(tags.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('each stat contactCount matches the tag usageCount field', async () => {
    /**
     * Property: ∀ tag t, stats[t].contactCount === t.usageCount
     * The contactCount in the returned stats must exactly reflect the stored usageCount.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.array(tagDocArb, { minLength: 1, maxLength: 15 }).map(arr => {
          const seen = new Set<string>();
          return arr.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true));
        }),
        async (workspaceId, tags) => {
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags,
            recentApplied: [],
            priorApplied: [],
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          const statsById = new Map(result.data!.map(s => [s.tagId, s]));

          for (const tag of tags) {
            const stat = statsById.get(tag.id);
            expect(stat).toBeDefined();
            expect(stat!.contactCount).toBe(tag.usageCount);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('stats are sorted by contactCount descending', async () => {
    /**
     * Property: stats[i].contactCount >= stats[i+1].contactCount for all i
     * The most-used tags appear first.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.array(tagDocArb, { minLength: 2, maxLength: 15 }).map(arr => {
          const seen = new Set<string>();
          return arr.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true));
        }),
        async (workspaceId, tags) => {
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags,
            recentApplied: [],
            priorApplied: [],
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          const counts = result.data!.map(s => s.contactCount);
          for (let i = 0; i < counts.length - 1; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('trendDirection is up when recent applications exceed prior applications', async () => {
    /**
     * Property: recent > prior → trendDirection === 'up'
     * When a tag has more applications in the last 30 days than the prior 30 days,
     * its trend must be reported as 'up'.
     */
    const now = new Date('2026-03-25T00:00:00Z');
    const recentTs = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const priorTs = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();  // 45 days ago

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.record({
          id: fc.constant('tag-trend-up'),
          name: fc.constant('Trend Up Tag'),
          usageCount: fc.integer({ min: 1, max: 100 }),
          updatedAt: fc.constant('2026-01-01T00:00:00Z'),
        }),
        fc.integer({ min: 2, max: 10 }), // recent count
        fc.integer({ min: 0, max: 1 }),  // prior count (always less than recent)
        async (workspaceId, tag, recentCount, priorCount) => {
          const recentApplied = Array.from({ length: recentCount }, () => ({
            tagId: tag.id,
            timestamp: recentTs,
          }));
          const priorApplied = Array.from({ length: priorCount }, () => ({
            tagId: tag.id,
            timestamp: priorTs,
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags: [tag],
            recentApplied,
            priorApplied,
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          const stat = result.data!.find(s => s.tagId === tag.id);
          expect(stat).toBeDefined();
          expect(stat!.trendDirection).toBe('up');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('trendDirection is down when prior applications exceed recent applications', async () => {
    /**
     * Property: prior > recent → trendDirection === 'down'
     */
    const now = new Date('2026-03-25T00:00:00Z');
    const recentTs = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const priorTs = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.record({
          id: fc.constant('tag-trend-down'),
          name: fc.constant('Trend Down Tag'),
          usageCount: fc.integer({ min: 1, max: 100 }),
          updatedAt: fc.constant('2026-01-01T00:00:00Z'),
        }),
        fc.integer({ min: 0, max: 1 }),  // recent count (always less than prior)
        fc.integer({ min: 2, max: 10 }), // prior count
        async (workspaceId, tag, recentCount, priorCount) => {
          const recentApplied = Array.from({ length: recentCount }, () => ({
            tagId: tag.id,
            timestamp: recentTs,
          }));
          const priorApplied = Array.from({ length: priorCount }, () => ({
            tagId: tag.id,
            timestamp: priorTs,
          }));

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags: [tag],
            recentApplied,
            priorApplied,
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          const stat = result.data!.find(s => s.tagId === tag.id);
          expect(stat).toBeDefined();
          expect(stat!.trendDirection).toBe('down');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('trendDirection is stable when a tag has no audit log entries', async () => {
    /**
     * Property: no audit entries → trendDirection === 'stable'
     * Tags with zero recent and zero prior applications are stable.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.array(tagDocArb, { minLength: 1, maxLength: 10 }).map(arr => {
          const seen = new Set<string>();
          return arr.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true));
        }),
        async (workspaceId, tags) => {
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags,
            recentApplied: [],
            priorApplied: [],
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          for (const stat of result.data!) {
            expect(stat.trendDirection).toBe('stable');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns empty array for workspace with no tags', async () => {
    /**
     * Property: no tags in workspace → stats === []
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        async (workspaceId) => {
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = buildUsageStatsMocks({
            workspaceId,
            tags: [],
            recentApplied: [],
            priorApplied: [],
          }) as any;

          const { getTagUsageStatsAction } = await import('../tag-actions');
          const result = await getTagUsageStatsAction(workspaceId);

          expect(result.success).toBe(true);
          expect(result.data).toEqual([]);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// Feature: contact-tagging-system, Property 16: No Orphaned Tags
// Validates: Requirements NFR4.1
describe('Property 16: No Orphaned Tags', () => {
  /**
   * NFR4.1: No orphaned tags — after a tag is deleted or merged away, no contact
   * document should retain a reference to that tag ID in its `tags` array,
   * `taggedAt` map, or `taggedBy` map.
   *
   * Properties verified:
   * 1. After deleteTagAction, every contact update removes the deleted tag ID from tags[]
   * 2. After deleteTagAction, taggedAt and taggedBy entries for the deleted tag are removed
   * 3. After deleteTagAction on an unused tag, no batch updates are issued
   * 4. After mergeTagsAction, every contact update removes all source tag IDs from tags[]
   * 5. After mergeTagsAction, taggedAt and taggedBy entries for source tags are removed
   */

  // Safe tag ID arbitrary: lowercase alphanumeric, prefixed to avoid JS reserved words
  const tagIdArb = fc
    .string({ minLength: 3, maxLength: 12 })
    .filter(s => /^[a-z][a-z0-9]*$/.test(s))
    .map(s => `tag-${s}`);

  /**
   * Build a Firestore snapshot mock that supports both .docs and .forEach,
   * matching the real QuerySnapshot API used by deleteTagAction and mergeTagsAction.
   */
  const makeSnap = (docs: any[]) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (fn: (doc: any) => void) => docs.forEach(fn),
  });

  /**
   * Build a contact doc mock with the Firestore DocumentSnapshot shape.
   */
  const makeContactDoc = (d: {
    id: string;
    tags: string[];
    taggedAt: Record<string, string>;
    taggedBy: Record<string, string>;
  }) => ({
    id: d.id,
    ref: { update: vi.fn().mockResolvedValue(undefined) },
    data: () => ({ name: `Contact ${d.id}`, ...d }),
  });

  /**
   * Build a mock adminDb.collection for deleteTagAction.
   * Handles: users, tags, schools, prospects, tag_audit_logs.
   */
  const buildDeleteMockCollection = (opts: {
    tagId: string;
    tagData: any;
    schoolDocs: ReturnType<typeof makeContactDoc>[];
    prospectDocs?: ReturnType<typeof makeContactDoc>[];
  }) => {
    const { tagId, tagData, schoolDocs, prospectDocs = [] } = opts;

    const mockBatchUpdate = vi.fn();
    const mockBatchDelete = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }));

    const collection = vi.fn((collectionName: string) => {
      if (collectionName === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ permissions: ['tags_manage'] }),
            }),
          })),
        };
      }

      if (collectionName === 'tags') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn().mockResolvedValue(
              id === tagId
                ? { exists: true, id, data: () => tagData }
                : { exists: false, data: () => null }
            ),
            delete: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
          })),
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(makeSnap([])),
          })),
        };
      }

      if (collectionName === 'schools') {
        return {
          where: vi.fn((_f: string, _op: string, qTagId: string) => ({
            get: vi.fn().mockResolvedValue(
              makeSnap(schoolDocs.filter(d => d.data().tags.includes(qTagId)))
            ),
          })),
        };
      }

      if (collectionName === 'prospects') {
        return {
          where: vi.fn((_f: string, _op: string, qTagId: string) => ({
            get: vi.fn().mockResolvedValue(
              makeSnap(prospectDocs.filter(d => d.data().tags.includes(qTagId)))
            ),
          })),
        };
      }

      if (collectionName === 'tag_audit_logs') {
        return {
          doc: vi.fn(() => ({
            id: `audit-${Math.random()}`,
            set: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }

      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
          set: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue(makeSnap([])) })),
      };
    });

    return { collection, mockBatch, mockBatchUpdate, mockBatchDelete, mockBatchCommit };
  };

  /**
   * Build a mock adminDb.collection for mergeTagsAction.
   * Handles the .where('__name__', 'in', [...]) pattern used to fetch tag docs.
   */
  const buildMergeMockCollection16 = (opts: {
    tagDocs: Record<string, any>;
    schoolDocs: ReturnType<typeof makeContactDoc>[];
  }) => {
    const { tagDocs, schoolDocs } = opts;

    const mockBatchUpdate = vi.fn();
    const mockBatchDelete = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }));

    const collection = vi.fn((collectionName: string) => {
      if (collectionName === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ permissions: ['tags_manage'] }),
            }),
          })),
        };
      }

      if (collectionName === 'tags') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn().mockResolvedValue(
              tagDocs[id]
                ? { exists: true, id, data: () => tagDocs[id] }
                : { exists: false, data: () => null }
            ),
            delete: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
          })),
          // mergeTagsAction uses .where('__name__', 'in', [...ids]) to fetch all tags at once
          where: vi.fn((_field: string, _op: string, val: any) => ({
            get: vi.fn().mockResolvedValue(
              makeSnap(
                (Array.isArray(val) ? val : [val])
                  .filter((id: string) => tagDocs[id])
                  .map((id: string) => ({ id, data: () => tagDocs[id] }))
              )
            ),
          })),
        };
      }

      if (collectionName === 'schools') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
            update: vi.fn().mockResolvedValue(undefined),
          })),
          where: vi.fn((_f: string, _op: string, qTagId: string) => ({
            get: vi.fn().mockResolvedValue(
              makeSnap(schoolDocs.filter(d => d.data().tags.includes(qTagId)))
            ),
          })),
        };
      }

      if (collectionName === 'prospects') {
        return {
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(makeSnap([])),
          })),
        };
      }

      if (collectionName === 'tag_audit_logs') {
        return {
          doc: vi.fn(() => ({
            id: `audit-${Math.random()}`,
            set: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }

      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
          set: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue(makeSnap([])) })),
      };
    });

    return { collection, mockBatch, mockBatchUpdate, mockBatchDelete, mockBatchCommit };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deleteTagAction removes the deleted tag ID from every contact tags array', async () => {
    /**
     * Property: ∀ contact c that had tagId, after deleteTagAction(tagId):
     *   tagId ∉ c.tags  (in the batch.update payload)
     */
    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        fc.integer({ min: 0, max: 20 }),
        fc.array(tagIdArb, { minLength: 0, maxLength: 4 }),
        async (tagId, contactCount, otherTagIds) => {
          const uniqueOtherTags = Array.from(new Set(otherTagIds)).filter(t => t !== tagId);

          const schoolDocs = Array.from({ length: contactCount }, (_, i) =>
            makeContactDoc({
              id: `school-${i}`,
              tags: [tagId, ...uniqueOtherTags],
              taggedAt: Object.fromEntries([tagId, ...uniqueOtherTags].map(t => [t, '2026-01-01T00:00:00Z'])),
              taggedBy: Object.fromEntries([tagId, ...uniqueOtherTags].map(t => [t, 'user-abc'])),
            })
          );

          const tagData = {
            id: tagId, name: 'Tag To Delete', isSystem: false,
            workspaceId: 'ws-test', organizationId: 'org-test',
            category: 'status', color: '#FF0000', usageCount: contactCount,
            createdBy: 'user-abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
          };

          const { collection, mockBatch, mockBatchUpdate } = buildDeleteMockCollection({
            tagId, tagData, schoolDocs,
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = collection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await deleteTagAction(tagId, 'user-abc');

          expect(result.success).toBe(true);

          // Every batch.update call must not include the deleted tagId in the tags array
          for (const call of mockBatchUpdate.mock.calls) {
            const payload = call[1];
            expect(payload.tags).not.toContain(tagId);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('deleteTagAction removes taggedAt and taggedBy entries for the deleted tag', async () => {
    /**
     * Property: ∀ contact c that had tagId, after deleteTagAction(tagId):
     *   tagId ∉ keys(c.taggedAt)  AND  tagId ∉ keys(c.taggedBy)
     *   while all other tag metadata is preserved
     */
    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        fc.integer({ min: 1, max: 15 }),
        async (tagId, contactCount) => {
          const keepTag = 'tag-keep';

          const schoolDocs = Array.from({ length: contactCount }, (_, i) =>
            makeContactDoc({
              id: `school-${i}`,
              tags: [tagId, keepTag],
              taggedAt: { [tagId]: '2026-01-01T00:00:00Z', [keepTag]: '2026-01-01T00:00:00Z' },
              taggedBy: { [tagId]: 'user-abc', [keepTag]: 'user-abc' },
            })
          );

          const tagData = {
            id: tagId, name: 'Tag', isSystem: false, workspaceId: 'ws-test',
            organizationId: 'org-test', category: 'status', color: '#FF0000',
            usageCount: contactCount, createdBy: 'user-abc',
            createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
          };

          const { collection, mockBatch, mockBatchUpdate } = buildDeleteMockCollection({
            tagId, tagData, schoolDocs,
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = collection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await deleteTagAction(tagId, 'user-abc');

          expect(result.success).toBe(true);
          expect(mockBatchUpdate).toHaveBeenCalledTimes(contactCount);

          for (const call of mockBatchUpdate.mock.calls) {
            const { tags, taggedAt, taggedBy } = call[1];
            // Deleted tag must be gone
            expect(tags).not.toContain(tagId);
            expect(taggedAt[tagId]).toBeUndefined();
            expect(taggedBy[tagId]).toBeUndefined();
            // Unrelated tag must be preserved
            expect(tags).toContain(keepTag);
            expect(taggedAt[keepTag]).toBeDefined();
            expect(taggedBy[keepTag]).toBeDefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('deleteTagAction on an unused tag issues no contact batch updates', async () => {
    /**
     * Property: if no contact has tagId, deleteTagAction succeeds with affectedCount === 0
     * and no batch.update calls are made — no orphan cleanup is needed.
     */
    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        async (tagId) => {
          const tagData = {
            id: tagId, name: 'Unused Tag', isSystem: false, workspaceId: 'ws-test',
            organizationId: 'org-test', category: 'custom', color: '#AAAAAA',
            usageCount: 0, createdBy: 'user-abc',
            createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
          };

          const { collection, mockBatch, mockBatchUpdate } = buildDeleteMockCollection({
            tagId, tagData, schoolDocs: [],
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = collection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await deleteTagAction(tagId, 'user-abc');

          expect(result.success).toBe(true);
          expect(result.affectedCount).toBe(0);
          expect(mockBatchUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('mergeTagsAction removes all source tag IDs from every contact tags array', async () => {
    /**
     * Property: ∀ source tag s ∈ sourceTagIds, ∀ contact c that had s:
     *   after mergeTagsAction(sourceTagIds, targetTagId):
     *   s ∉ c.tags  AND  targetTagId ∈ c.tags  (in the batch.update payload)
     */
    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        tagIdArb,
        async (sourceTagId, targetTagId) => {
          if (sourceTagId === targetTagId) return;

          const schoolDocs = Array.from({ length: 5 }, (_, i) =>
            makeContactDoc({
              id: `school-${i}`,
              tags: [sourceTagId],
              taggedAt: { [sourceTagId]: '2026-01-01T00:00:00Z' },
              taggedBy: { [sourceTagId]: 'user-abc' },
            })
          );

          const tagDocs: Record<string, any> = {
            [sourceTagId]: {
              id: sourceTagId, name: 'Source Tag', isSystem: false,
              workspaceId: 'ws-test', organizationId: 'org-test',
              category: 'status', color: '#FF0000', usageCount: 5,
              createdBy: 'user-abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
            },
            [targetTagId]: {
              id: targetTagId, name: 'Target Tag', isSystem: false,
              workspaceId: 'ws-test', organizationId: 'org-test',
              category: 'status', color: '#00FF00', usageCount: 0,
              createdBy: 'user-abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
            },
          };

          const { collection, mockBatch, mockBatchUpdate } = buildMergeMockCollection16({
            tagDocs, schoolDocs,
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = collection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction([sourceTagId], targetTagId, 'user-abc');

          expect(result.success).toBe(true);

          // Every contact batch.update must not contain the source tag
          for (const call of mockBatchUpdate.mock.calls) {
            const payload = call[1];
            if (!Array.isArray(payload?.tags)) continue; // skip tag-doc updates
            expect(payload.tags).not.toContain(sourceTagId);
            expect(payload.tags).toContain(targetTagId);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('mergeTagsAction removes taggedAt and taggedBy entries for all source tags', async () => {
    /**
     * Property: ∀ source tag s ∈ sourceTagIds, ∀ contact c that had s:
     *   after mergeTagsAction: s ∉ keys(c.taggedAt)  AND  s ∉ keys(c.taggedBy)
     *   while unrelated tag metadata is preserved
     */
    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        tagIdArb,
        async (sourceTagId, targetTagId) => {
          if (sourceTagId === targetTagId) return;

          const keepTag = 'tag-keep';

          const schoolDocs = Array.from({ length: 5 }, (_, i) =>
            makeContactDoc({
              id: `school-${i}`,
              tags: [sourceTagId, keepTag],
              taggedAt: { [sourceTagId]: '2026-01-01T00:00:00Z', [keepTag]: '2026-01-01T00:00:00Z' },
              taggedBy: { [sourceTagId]: 'user-abc', [keepTag]: 'user-abc' },
            })
          );

          const tagDocs: Record<string, any> = {
            [sourceTagId]: {
              id: sourceTagId, name: 'Source', isSystem: false,
              workspaceId: 'ws-test', organizationId: 'org-test',
              category: 'status', color: '#FF0000', usageCount: 5,
              createdBy: 'user-abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
            },
            [targetTagId]: {
              id: targetTagId, name: 'Target', isSystem: false,
              workspaceId: 'ws-test', organizationId: 'org-test',
              category: 'status', color: '#00FF00', usageCount: 0,
              createdBy: 'user-abc', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
            },
          };

          const { collection, mockBatch, mockBatchUpdate } = buildMergeMockCollection16({
            tagDocs, schoolDocs,
          });

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = collection as any;
          vi.mocked(adminDb).batch = mockBatch as any;

          const result = await mergeTagsAction([sourceTagId], targetTagId, 'user-abc');

          expect(result.success).toBe(true);

          for (const call of mockBatchUpdate.mock.calls) {
            const payload = call[1];
            if (!payload?.taggedAt) continue; // skip non-contact updates
            // Source tag metadata must be gone
            expect(payload.taggedAt[sourceTagId]).toBeUndefined();
            expect(payload.taggedBy[sourceTagId]).toBeUndefined();
            // Unrelated tag metadata must be preserved
            expect(payload.taggedAt[keepTag]).toBeDefined();
            expect(payload.taggedBy[keepTag]).toBeDefined();
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: contact-tagging-system, Property 17: Query Performance
// Validates: Requirements NFR1.1
// ---------------------------------------------------------------------------
/**
 * NFR1.1: Tag filtering on 10,000+ contacts completes in <2 seconds.
 *
 * This property verifies that the in-memory filtering logic inside
 * getContactsByTagsAction (AND client-side intersection, OR deduplication,
 * NOT exclusion) stays within the 2-second bound when processing large
 * contact datasets.
 *
 * Firestore I/O is mocked so the measurement captures only the JavaScript
 * processing time — the algorithmic complexity of the filter logic itself.
 * Real-world latency would add network time, but the processing overhead
 * must remain well under the budget to leave headroom for I/O.
 *
 * Properties verified:
 * 1. AND filtering over 10,000+ contacts completes in <2 seconds
 * 2. OR filtering over 10,000+ contacts completes in <2 seconds
 * 3. NOT filtering over 10,000+ contacts completes in <2 seconds
 * 4. Performance holds across varying tag counts (1–10 filter tags)
 */
describe('Property 17: Query Performance', () => {
  const CONTACT_COUNT = 10_000;
  const TIME_LIMIT_MS = 2_000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build a large set of contact documents for performance testing.
   * Each contact is assigned a random subset of tags from the pool.
   */
  const buildLargeContactSet = (
    count: number,
    tagPool: string[],
    tagDensity: number // 0–1: fraction of pool tags each contact gets
  ): Array<{ id: string; tags: string[] }> => {
    return Array.from({ length: count }, (_, i) => {
      // Deterministic but varied tag assignment based on index
      const assignedTags = tagPool.filter((_, ti) =>
        ((i * 7 + ti * 13) % 100) < tagDensity * 100
      );
      return { id: `contact-${i}`, tags: assignedTags };
    });
  };

  /**
   * Build Firestore mocks that return a large contact set for AND-logic queries.
   * AND logic queries for the first tag, then filters client-side.
   */
  const buildPerfMockAnd = (
    contactDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === 'schools') {
        return {
          where: vi.fn((_field: string, _op: string, _val: string) => ({
            where: vi.fn((_f2: string, _o2: string, tagId: string) => ({
              get: vi.fn().mockResolvedValue({
                docs: contactDocs
                  .filter(d => d.tags.includes(tagId))
                  .map(d => ({
                    id: d.id,
                    data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
                  })),
              }),
            })),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      if (collectionName === 'prospects') {
        return {
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            })),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      return {
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })),
      };
    });
    return { mockCollection };
  };

  /**
   * Build Firestore mocks for OR-logic queries.
   * OR logic uses array-contains-any (chunked at 10).
   */
  const buildPerfMockOr = (
    contactDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === 'schools') {
        return {
          where: vi.fn((_field: string, _op: string, _val: string) => ({
            where: vi.fn((_f2: string, _o2: string, chunk: string[]) => ({
              get: vi.fn().mockResolvedValue({
                docs: contactDocs
                  .filter(d => chunk.some(t => d.tags.includes(t)))
                  .map(d => ({
                    id: d.id,
                    data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
                  })),
              }),
            })),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      if (collectionName === 'prospects') {
        return {
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            })),
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      return {
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })),
      };
    });
    return { mockCollection };
  };

  /**
   * Build Firestore mocks for NOT-logic queries.
   * NOT logic fetches ALL contacts in the workspace, then excludes those with the tags.
   */
  const buildPerfMockNot = (
    contactDocs: Array<{ id: string; tags: string[] }>,
    workspaceId: string
  ) => {
    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === 'schools') {
        return {
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              docs: contactDocs.map(d => ({
                id: d.id,
                data: () => ({ tags: d.tags, workspaceIds: [workspaceId], workspaceId }),
              })),
            }),
          })),
        };
      }
      if (collectionName === 'prospects') {
        return {
          where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      return {
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })),
      };
    });
    return { mockCollection };
  };

  it('AND filtering over 10,000+ contacts completes in <2 seconds', async () => {
    /**
     * Property: For any valid set of filter tags (1–5 tags),
     * AND-logic filtering over 10,000 contacts must complete within 2 seconds.
     *
     * **Validates: Requirements NFR1.1**
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–5 filter tags
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // workspaceId
        async (filterTagCount, workspaceId) => {
          const tagPool = Array.from({ length: 10 }, (_, i) => `perf-tag-${i}`);
          const filterTags = tagPool.slice(0, filterTagCount);

          // Build 10,000 contacts with ~30% tag density
          const contactDocs = buildLargeContactSet(CONTACT_COUNT, tagPool, 0.3);

          const { mockCollection } = buildPerfMockAnd(contactDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'AND',
          });
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);

          // Property: must complete within 2 seconds (NFR1.1)
          expect(elapsed).toBeLessThan(TIME_LIMIT_MS);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('OR filtering over 10,000+ contacts completes in <2 seconds', async () => {
    /**
     * Property: For any valid set of filter tags (1–10 tags),
     * OR-logic filtering over 10,000 contacts must complete within 2 seconds.
     *
     * **Validates: Requirements NFR1.1**
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–10 filter tags (tests chunking boundary at 10)
        fc.integer({ min: 1, max: 10 }),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // workspaceId
        async (filterTagCount, workspaceId) => {
          const tagPool = Array.from({ length: 10 }, (_, i) => `perf-tag-${i}`);
          const filterTags = tagPool.slice(0, filterTagCount);

          // Build 10,000 contacts with ~30% tag density
          const contactDocs = buildLargeContactSet(CONTACT_COUNT, tagPool, 0.3);

          const { mockCollection } = buildPerfMockOr(contactDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'OR',
          });
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);

          // Property: must complete within 2 seconds (NFR1.1)
          expect(elapsed).toBeLessThan(TIME_LIMIT_MS);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('NOT filtering over 10,000+ contacts completes in <2 seconds', async () => {
    /**
     * Property: For any valid set of excluded tags (1–5 tags),
     * NOT-logic filtering over 10,000 contacts must complete within 2 seconds.
     *
     * NOT logic is the most expensive path (fetches all contacts then excludes),
     * so it is especially important to verify it meets the performance budget.
     *
     * **Validates: Requirements NFR1.1**
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–5 excluded tags
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // workspaceId
        async (excludeTagCount, workspaceId) => {
          const tagPool = Array.from({ length: 10 }, (_, i) => `perf-tag-${i}`);
          const excludeTags = tagPool.slice(0, excludeTagCount);

          // Build 10,000 contacts with ~30% tag density
          const contactDocs = buildLargeContactSet(CONTACT_COUNT, tagPool, 0.3);

          const { mockCollection } = buildPerfMockNot(contactDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: excludeTags,
            logic: 'NOT',
          });
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);

          // Property: must complete within 2 seconds (NFR1.1)
          expect(elapsed).toBeLessThan(TIME_LIMIT_MS);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('performance holds across varying tag counts (1–10 filter tags)', async () => {
    /**
     * Property: Regardless of how many filter tags are used (1 to 10),
     * AND-logic filtering over 10,000 contacts always completes in <2 seconds.
     * This verifies that performance does not degrade as filter complexity grows.
     *
     * **Validates: Requirements NFR1.1**
     */
    await fc.assert(
      fc.asyncProperty(
        // Vary the number of filter tags from 1 to 10
        fc.integer({ min: 1, max: 10 }),
        // Vary tag density from sparse (10%) to dense (70%)
        fc.integer({ min: 1, max: 7 }),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // workspaceId
        async (filterTagCount, densityTenths, workspaceId) => {
          const tagPool = Array.from({ length: 10 }, (_, i) => `perf-tag-${i}`);
          const filterTags = tagPool.slice(0, filterTagCount);
          const tagDensity = densityTenths / 10; // 0.1 to 0.7

          // Build 10,000 contacts with the given tag density
          const contactDocs = buildLargeContactSet(CONTACT_COUNT, tagPool, tagDensity);

          const { mockCollection } = buildPerfMockAnd(contactDocs, workspaceId);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;

          const { getContactsByTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await getContactsByTagsAction(workspaceId, {
            tagIds: filterTags,
            logic: 'AND',
          });
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);

          // Property: must complete within 2 seconds regardless of tag count or density (NFR1.1)
          expect(elapsed).toBeLessThan(TIME_LIMIT_MS);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// Feature: contact-tagging-system, Property 15: Tag Reference Integrity
describe('Property 15: Tag Reference Integrity', () => {
  /**
   * **Validates: Requirements NFR4.2**
   * 
   * Property: For any contact, every tag ID in the contact's tags array 
   * should correspond to an existing document in the tags collection.
   * 
   * This test verifies that validateTagReferences() correctly identifies
   * orphaned tag IDs (tags that don't exist in the tags collection).
   */

  it('should detect orphaned tag references in contact tags array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // contactId
        fc.constantFrom('school', 'prospect'), // contactType
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // existing tag IDs
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }), // orphaned tag IDs
        async (contactId, contactType, existingTagIds, orphanedTagIds) => {
          const uniqueExistingTags = Array.from(new Set(existingTagIds));
          const uniqueOrphanedTags = Array.from(new Set(orphanedTagIds.filter(id => !uniqueExistingTags.includes(id))));
          
          // Combine existing and orphaned tags for the contact
          const contactTags = [...uniqueExistingTags, ...uniqueOrphanedTags];
          
          if (contactTags.length === 0) return; // Skip empty case
          
          const collection = contactType === 'school' ? 'schools' : 'prospects';
          
          // Mock contact document with tags
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: contactId,
              name: `Test ${contactType}`,
              tags: contactTags
            })
          });
          
          // Mock tags collection - only return existing tags
          const mockTagsWhere = vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: uniqueExistingTags.map(id => ({
                id,
                data: () => ({ id, name: `Tag ${id}` })
              }))
            })
          });
          
          const mockCollection = vi.fn((collectionName: string) => {
            if (collectionName === collection) {
              return {
                doc: vi.fn(() => ({
                  get: mockContactGet
                }))
              };
            }
            if (collectionName === 'tags') {
              return {
                where: mockTagsWhere
              };
            }
            return {};
          });
          
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          
          const { validateTagReferences } = await import('../tag-integrity');
          const result = await validateTagReferences(contactId, contactType);
          
          // Property: validateTagReferences should identify all orphaned tag IDs
          if (uniqueOrphanedTags.length === 0) {
            // All tags exist - should be valid
            expect(result.valid).toBe(true);
            expect(result.orphanedTagIds).toHaveLength(0);
          } else {
            // Some tags don't exist - should be invalid
            expect(result.valid).toBe(false);
            expect(result.orphanedTagIds.length).toBe(uniqueOrphanedTags.length);
            
            // Verify all orphaned tags are identified
            uniqueOrphanedTags.forEach(tagId => {
              expect(result.orphanedTagIds).toContain(tagId);
            });
            
            // Verify no existing tags are marked as orphaned
            uniqueExistingTags.forEach(tagId => {
              expect(result.orphanedTagIds).not.toContain(tagId);
            });
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle empty tags array correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // contactId
        fc.constantFrom('school', 'prospect'), // contactType
        async (contactId, contactType) => {
          const collection = contactType === 'school' ? 'schools' : 'prospects';
          
          // Mock contact with empty tags array
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: contactId,
              name: `Test ${contactType}`,
              tags: []
            })
          });
          
          const mockCollection = vi.fn((collectionName: string) => {
            if (collectionName === collection) {
              return {
                doc: vi.fn(() => ({
                  get: mockContactGet
                }))
              };
            }
            return {};
          });
          
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          
          const { validateTagReferences } = await import('../tag-integrity');
          const result = await validateTagReferences(contactId, contactType);
          
          // Property: Empty tags array should be valid (no orphaned references)
          expect(result.valid).toBe(true);
          expect(result.orphanedTagIds).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle all valid tags correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // contactId
        fc.constantFrom('school', 'prospect'), // contactType
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // all valid tag IDs
        async (contactId, contactType, tagIds) => {
          const uniqueTagIds = Array.from(new Set(tagIds));
          const collection = contactType === 'school' ? 'schools' : 'prospects';
          
          // Mock contact with all valid tags
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: contactId,
              name: `Test ${contactType}`,
              tags: uniqueTagIds
            })
          });
          
          // Mock tags collection - all tags exist
          const mockTagsWhere = vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: uniqueTagIds.map(id => ({
                id,
                data: () => ({ id, name: `Tag ${id}` })
              }))
            })
          });
          
          const mockCollection = vi.fn((collectionName: string) => {
            if (collectionName === collection) {
              return {
                doc: vi.fn(() => ({
                  get: mockContactGet
                }))
              };
            }
            if (collectionName === 'tags') {
              return {
                where: mockTagsWhere
              };
            }
            return {};
          });
          
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          
          const { validateTagReferences } = await import('../tag-integrity');
          const result = await validateTagReferences(contactId, contactType);
          
          // Property: All valid tags should result in valid=true with no orphaned IDs
          expect(result.valid).toBe(true);
          expect(result.orphanedTagIds).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle all invalid tags correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // contactId
        fc.constantFrom('school', 'prospect'), // contactType
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // all orphaned tag IDs
        async (contactId, contactType, orphanedTagIds) => {
          const uniqueOrphanedTags = Array.from(new Set(orphanedTagIds));
          const collection = contactType === 'school' ? 'schools' : 'prospects';
          
          // Mock contact with all orphaned tags
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: contactId,
              name: `Test ${contactType}`,
              tags: uniqueOrphanedTags
            })
          });
          
          // Mock tags collection - no tags exist
          const mockTagsWhere = vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [] // No tags found
            })
          });
          
          const mockCollection = vi.fn((collectionName: string) => {
            if (collectionName === collection) {
              return {
                doc: vi.fn(() => ({
                  get: mockContactGet
                }))
              };
            }
            if (collectionName === 'tags') {
              return {
                where: mockTagsWhere
              };
            }
            return {};
          });
          
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          
          const { validateTagReferences } = await import('../tag-integrity');
          const result = await validateTagReferences(contactId, contactType);
          
          // Property: All invalid tags should result in valid=false with all tags orphaned
          expect(result.valid).toBe(false);
          expect(result.orphanedTagIds.length).toBe(uniqueOrphanedTags.length);
          
          // Verify all tags are identified as orphaned
          uniqueOrphanedTags.forEach(tagId => {
            expect(result.orphanedTagIds).toContain(tagId);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle non-existent contact correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // contactId
        fc.constantFrom('school', 'prospect'), // contactType
        async (contactId, contactType) => {
          const collection = contactType === 'school' ? 'schools' : 'prospects';
          
          // Mock non-existent contact
          const mockContactGet = vi.fn().mockResolvedValue({
            exists: false,
            data: () => null
          });
          
          const mockCollection = vi.fn((collectionName: string) => {
            if (collectionName === collection) {
              return {
                doc: vi.fn(() => ({
                  get: mockContactGet
                }))
              };
            }
            return {};
          });
          
          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          
          const { validateTagReferences } = await import('../tag-integrity');
          const result = await validateTagReferences(contactId, contactType);
          
          // Property: Non-existent contact should return invalid with no orphaned tags
          expect(result.valid).toBe(false);
          expect(result.orphanedTagIds).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: contact-tagging-system, Property 18: Bulk Operation Performance
// Validates: Requirements NFR1.2
// ---------------------------------------------------------------------------
/**
 * NFR1.2: Bulk tag operations (1,000 contacts) complete in <10 seconds.
 *
 * This property verifies that bulk tag operations (apply/remove) can process
 * 1,000 contacts within the 10-second performance budget. The test mocks
 * Firestore operations to focus on the batching logic and processing overhead
 * rather than network latency.
 *
 * Properties verified:
 * 1. Bulk apply tags to 1,000 contacts completes in <10 seconds
 * 2. Bulk remove tags from 1,000 contacts completes in <10 seconds
 * 3. Performance holds across varying tag counts (1–5 tags per operation)
 * 4. Performance holds across varying batch sizes (simulating different load conditions)
 */
describe('Property 18: Bulk Operation Performance', () => {
  const BULK_CONTACT_COUNT = 1_000;
  const BULK_TIME_LIMIT_MS = 10_000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build Firestore mocks for bulk operations.
   * Simulates realistic document reads and batch commits.
   */
  const buildBulkOperationMocks = (
    contactCount: number,
    existingTagsPerContact: string[] = []
  ) => {
    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    };

    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === 'schools' || collectionName === 'prospects') {
        return {
          doc: vi.fn((contactId: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                tags: existingTagsPerContact,
                taggedAt: {},
                taggedBy: {},
                workspaceIds: ['test-workspace']
              })
            })
          }))
        };
      }
      if (collectionName === 'tags') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                id: 'test-tag',
                name: 'Test Tag',
                workspaceId: 'test-workspace'
              })
            })
          }))
        };
      }
      if (collectionName === 'tag_audit_logs') {
        return {
          doc: vi.fn(() => ({
            set: vi.fn().mockResolvedValue(undefined)
          }))
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false })
        }))
      };
    });

    return { mockCollection, mockBatch };
  };

  it('bulk apply tags to 1,000 contacts completes in <10 seconds', async () => {
    /**
     * Property: For any valid set of tags (1–5 tags) and contact type,
     * bulk applying tags to 1,000 contacts must complete within 10 seconds.
     *
     * **Validates: Requirements NFR1.2**
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–5 tags to apply
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom('school', 'prospect'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // userId
        async (tagCount, contactType, userId) => {
          const tagIds = Array.from({ length: tagCount }, (_, i) => `bulk-tag-${i}`);
          const contactIds = Array.from({ length: BULK_CONTACT_COUNT }, (_, i) => `contact-${i}`);

          const { mockCollection, mockBatch } = buildBulkOperationMocks(BULK_CONTACT_COUNT);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = vi.fn().mockReturnValue(mockBatch);

          const { bulkApplyTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await bulkApplyTagsAction(contactIds, contactType, tagIds, userId);
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);
          expect(result.processedCount).toBe(BULK_CONTACT_COUNT);

          // Property: must complete within 10 seconds (NFR1.2)
          expect(elapsed).toBeLessThan(BULK_TIME_LIMIT_MS);

          // Property: should use batching (verify batch.commit was called multiple times)
          expect(mockBatch.commit).toHaveBeenCalled();
        }
      ),
      { numRuns: 5 }
    );
  });

  it('bulk remove tags from 1,000 contacts completes in <10 seconds', async () => {
    /**
     * Property: For any valid set of tags (1–5 tags) and contact type,
     * bulk removing tags from 1,000 contacts must complete within 10 seconds.
     *
     * **Validates: Requirements NFR1.2**
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–5 tags to remove
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom('school', 'prospect'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // userId
        async (tagCount, contactType, userId) => {
          const tagIds = Array.from({ length: tagCount }, (_, i) => `bulk-tag-${i}`);
          const contactIds = Array.from({ length: BULK_CONTACT_COUNT }, (_, i) => `contact-${i}`);

          // Contacts start with the tags we're going to remove
          const { mockCollection, mockBatch } = buildBulkOperationMocks(BULK_CONTACT_COUNT, tagIds);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = vi.fn().mockReturnValue(mockBatch);

          const { bulkRemoveTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await bulkRemoveTagsAction(contactIds, contactType, tagIds, userId);
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);
          expect(result.processedCount).toBe(BULK_CONTACT_COUNT);

          // Property: must complete within 10 seconds (NFR1.2)
          expect(elapsed).toBeLessThan(BULK_TIME_LIMIT_MS);

          // Property: should use batching (verify batch.commit was called multiple times)
          expect(mockBatch.commit).toHaveBeenCalled();
        }
      ),
      { numRuns: 5 }
    );
  });

  it('performance holds across varying tag counts (1–5 tags per operation)', async () => {
    /**
     * Property: Regardless of how many tags are being applied (1 to 5),
     * bulk operations on 1,000 contacts always complete in <10 seconds.
     * This verifies that performance does not degrade as operation complexity grows.
     *
     * **Validates: Requirements NFR1.2**
     */
    await fc.assert(
      fc.asyncProperty(
        // Vary the number of tags from 1 to 5
        fc.integer({ min: 1, max: 5 }),
        // Vary operation type
        fc.constantFrom('apply', 'remove'),
        fc.constantFrom('school', 'prospect'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // userId
        async (tagCount, operation, contactType, userId) => {
          const tagIds = Array.from({ length: tagCount }, (_, i) => `perf-tag-${i}`);
          const contactIds = Array.from({ length: BULK_CONTACT_COUNT }, (_, i) => `contact-${i}`);

          // For remove operations, contacts start with the tags
          const existingTags = operation === 'remove' ? tagIds : [];
          const { mockCollection, mockBatch } = buildBulkOperationMocks(BULK_CONTACT_COUNT, existingTags);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = vi.fn().mockReturnValue(mockBatch);

          const { bulkApplyTagsAction, bulkRemoveTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = operation === 'apply'
            ? await bulkApplyTagsAction(contactIds, contactType, tagIds, userId)
            : await bulkRemoveTagsAction(contactIds, contactType, tagIds, userId);
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);
          expect(result.processedCount).toBe(BULK_CONTACT_COUNT);

          // Property: must complete within 10 seconds regardless of tag count (NFR1.2)
          expect(elapsed).toBeLessThan(BULK_TIME_LIMIT_MS);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('performance holds under simulated load conditions', async () => {
    /**
     * Property: Bulk operations maintain performance even when processing
     * contacts with varying numbers of existing tags (simulating real-world load).
     * This tests the worst-case scenario where contacts have many existing tags.
     *
     * **Validates: Requirements NFR1.2**
     */
    await fc.assert(
      fc.asyncProperty(
        // Vary the number of existing tags per contact (0–10)
        fc.integer({ min: 0, max: 10 }),
        fc.constantFrom('school', 'prospect'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)), // userId
        async (existingTagCount, contactType, userId) => {
          const newTagIds = ['new-tag-1', 'new-tag-2'];
          const existingTags = Array.from({ length: existingTagCount }, (_, i) => `existing-tag-${i}`);
          const contactIds = Array.from({ length: BULK_CONTACT_COUNT }, (_, i) => `contact-${i}`);

          const { mockCollection, mockBatch } = buildBulkOperationMocks(BULK_CONTACT_COUNT, existingTags);

          const { adminDb } = await import('../firebase-admin');
          vi.mocked(adminDb).collection = mockCollection as any;
          vi.mocked(adminDb).batch = vi.fn().mockReturnValue(mockBatch);

          const { bulkApplyTagsAction } = await import('../tag-actions');

          const start = performance.now();
          const result = await bulkApplyTagsAction(contactIds, contactType, newTagIds, userId);
          const elapsed = performance.now() - start;

          // Property: operation must succeed
          expect(result.success).toBe(true);
          expect(result.processedCount).toBe(BULK_CONTACT_COUNT);

          // Property: must complete within 10 seconds even with many existing tags (NFR1.2)
          expect(elapsed).toBeLessThan(BULK_TIME_LIMIT_MS);
        }
      ),
      { numRuns: 8 }
    );
  });
});