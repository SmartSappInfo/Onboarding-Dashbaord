/**
 * Property-Based Test: Tag Partition Invariant
 * 
 * **Property 4: Tag Partition Invariant**
 * **Validates: Requirements 7**
 * 
 * For any entity E and workspace W:
 * - globalTags(E) ∩ workspaceTags(W, E) may be non-empty (same tag can appear in both)
 * - BUT removing a workspaceTag from W must NOT remove it from globalTags(E)
 * - AND removing a globalTag from E must NOT remove it from workspaceTags(W, E)
 * 
 * This test verifies that operations on one scope do not affect the other scope.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { applyTagAction, removeTagAction, getEntityTagsAction } from '../scoped-tag-actions';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock Firestore
vi.mock('../firebase-admin', () => {
  // In-memory storage for testing
  const entities = new Map<string, any>();
  const workspaceEntities = new Map<string, any>();
  const tags = new Map<string, any>();

  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = entities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = entities.get(id) || {};
                entities.set(id, { ...existing, ...updates });
              }),
            })),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn((field: string, op: string, value: any) => {
              const filters: Array<{ field: string; op: string; value: any }> = [{ field, op, value }];
              return {
                where: vi.fn((field2: string, op2: string, value2: any) => {
                  filters.push({ field: field2, op: op2, value: value2 });
                  return {
                    limit: vi.fn(() => ({
                      get: vi.fn().mockImplementation(async () => {
                        let results = Array.from(workspaceEntities.values());
                        
                        // Apply filters
                        for (const filter of filters) {
                          results = results.filter((we: any) => {
                            if (filter.op === '==') {
                              return we[filter.field] === filter.value;
                            }
                            return true;
                          });
                        }
                        
                        return {
                          empty: results.length === 0,
                          docs: results.map((data: any) => ({
                            id: data.id,
                            ref: {
                              update: vi.fn().mockImplementation(async (updates: any) => {
                                workspaceEntities.set(data.id, { ...data, ...updates });
                              }),
                            },
                            data: () => data,
                          })),
                        };
                      }),
                    })),
                  };
                }),
              };
            }),
          };
        } else if (collectionName === 'tags') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const tag = tags.get(id);
                return {
                  exists: !!tag,
                  id,
                  data: () => tag,
                };
              }),
            })),
          };
        }
        return {};
      }),
      batch: vi.fn(() => ({
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    },
    FieldValue: {
      increment: vi.fn((n) => ({ _increment: n })),
    },
    // Expose storage for test setup
    __testStorage: {
      entities,
      workspaceEntities,
      tags,
      reset: () => {
        entities.clear();
        workspaceEntities.clear();
        tags.clear();
      },
    },
  };
});

describe('Property 4: Tag Partition Invariant', () => {
  let testStorage: {
    entities: Map<string, any>;
    workspaceEntities: Map<string, any>;
    tags: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should maintain tag partition: removing workspace tag does NOT remove global tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // globalTagIds
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // workspaceTagIds
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspaceId, globalTagIds, workspaceTagIds, userId) => {
          // Setup: Create entity and workspace_entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org-1',
            entityType: 'institution',
            name: 'Test Entity',
            globalTags: [],
            contacts: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          testStorage.workspaceEntities.set(`${entityId}-${workspaceId}`, {
            id: `${entityId}-${workspaceId}`,
            entityId,
            workspaceId,
            workspaceTags: [],
            organizationId: 'org-1',
            entityType: 'institution',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'active',
            displayName: 'Test Entity',
            addedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          // Setup tags with proper scopes
          globalTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'global',
              name: `Global Tag ${tagId}`,
              usageCount: 0,
            });
          });

          workspaceTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'workspace',
              name: `Workspace Tag ${tagId}`,
              usageCount: 0,
            });
          });

          // Apply global tags
          await applyTagAction(entityId, globalTagIds, null, userId);
          
          // Apply workspace tags
          await applyTagAction(entityId, workspaceTagIds, workspaceId, userId);

          // Verify both scopes have their respective tags
          const beforeRemoval = await getEntityTagsAction(entityId, workspaceId);
          expect(beforeRemoval.success).toBe(true);
          expect(beforeRemoval.globalTags).toEqual(expect.arrayContaining(globalTagIds));
          expect(beforeRemoval.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));

          // Remove workspace tags
          await removeTagAction(entityId, workspaceTagIds, workspaceId, userId);

          // Property: Global tags should remain unchanged
          const afterRemoval = await getEntityTagsAction(entityId, workspaceId);
          expect(afterRemoval.success).toBe(true);
          expect(afterRemoval.globalTags).toEqual(expect.arrayContaining(globalTagIds));
          expect(afterRemoval.workspaceTags).toEqual([]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain tag partition: removing global tag does NOT remove workspace tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // globalTagIds
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // workspaceTagIds
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspaceId, globalTagIds, workspaceTagIds, userId) => {
          // Setup: Create entity and workspace_entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org-1',
            entityType: 'institution',
            name: 'Test Entity',
            globalTags: [],
            contacts: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          testStorage.workspaceEntities.set(`${entityId}-${workspaceId}`, {
            id: `${entityId}-${workspaceId}`,
            entityId,
            workspaceId,
            workspaceTags: [],
            organizationId: 'org-1',
            entityType: 'institution',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'active',
            displayName: 'Test Entity',
            addedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          // Setup tags with proper scopes
          globalTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'global',
              name: `Global Tag ${tagId}`,
              usageCount: 0,
            });
          });

          workspaceTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'workspace',
              name: `Workspace Tag ${tagId}`,
              usageCount: 0,
            });
          });

          // Apply global tags
          await applyTagAction(entityId, globalTagIds, null, userId);
          
          // Apply workspace tags
          await applyTagAction(entityId, workspaceTagIds, workspaceId, userId);

          // Verify both scopes have their respective tags
          const beforeRemoval = await getEntityTagsAction(entityId, workspaceId);
          expect(beforeRemoval.success).toBe(true);
          expect(beforeRemoval.globalTags).toEqual(expect.arrayContaining(globalTagIds));
          expect(beforeRemoval.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));

          // Remove global tags
          await removeTagAction(entityId, globalTagIds, null, userId);

          // Property: Workspace tags should remain unchanged
          const afterRemoval = await getEntityTagsAction(entityId, workspaceId);
          expect(afterRemoval.success).toBe(true);
          expect(afterRemoval.globalTags).toEqual([]);
          expect(afterRemoval.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain tag partition: applying to one scope does not affect the other', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // globalTagIds
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // workspaceTagIds
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspaceId, globalTagIds, workspaceTagIds, userId) => {
          // Setup: Create entity and workspace_entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org-1',
            entityType: 'institution',
            name: 'Test Entity',
            globalTags: [],
            contacts: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          testStorage.workspaceEntities.set(`${entityId}-${workspaceId}`, {
            id: `${entityId}-${workspaceId}`,
            entityId,
            workspaceId,
            workspaceTags: [],
            organizationId: 'org-1',
            entityType: 'institution',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'active',
            displayName: 'Test Entity',
            addedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          // Setup tags with proper scopes
          globalTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'global',
              name: `Global Tag ${tagId}`,
              usageCount: 0,
            });
          });

          workspaceTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'workspace',
              name: `Workspace Tag ${tagId}`,
              usageCount: 0,
            });
          });

          // Apply different tags to each scope
          await applyTagAction(entityId, globalTagIds, null, userId);
          await applyTagAction(entityId, workspaceTagIds, workspaceId, userId);

          // Property: Each scope should only have its own tags
          const result = await getEntityTagsAction(entityId, workspaceId);
          expect(result.success).toBe(true);
          expect(result.globalTags).toEqual(expect.arrayContaining(globalTagIds));
          expect(result.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));

          // Verify no cross-contamination
          globalTagIds.forEach(tagId => {
            if (!workspaceTagIds.includes(tagId)) {
              expect(result.workspaceTags).not.toContain(tagId);
            }
          });

          workspaceTagIds.forEach(tagId => {
            if (!globalTagIds.includes(tagId)) {
              expect(result.globalTags).not.toContain(tagId);
            }
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should allow same tag ID in both scopes when tag has dual scope capability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // sharedTagIds
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        async (entityId, workspaceId, sharedTagIds, userId) => {
          // Setup: Create entity and workspace_entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId: 'org-1',
            entityType: 'institution',
            name: 'Test Entity',
            globalTags: [],
            contacts: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          testStorage.workspaceEntities.set(`${entityId}-${workspaceId}`, {
            id: `${entityId}-${workspaceId}`,
            entityId,
            workspaceId,
            workspaceTags: [],
            organizationId: 'org-1',
            entityType: 'institution',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'active',
            displayName: 'Test Entity',
            addedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
          });

          // Setup: Create global-scoped tags
          const globalTagIds = sharedTagIds.slice(0, Math.ceil(sharedTagIds.length / 2));
          const workspaceTagIds = sharedTagIds.slice(Math.ceil(sharedTagIds.length / 2));

          globalTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'global',
              name: `Global Tag ${tagId}`,
              usageCount: 0,
            });
          });

          workspaceTagIds.forEach(tagId => {
            testStorage.tags.set(tagId, {
              id: tagId,
              scope: 'workspace',
              name: `Workspace Tag ${tagId}`,
              usageCount: 0,
            });
          });

          // Apply global tags
          await applyTagAction(entityId, globalTagIds, null, userId);
          
          // Apply workspace tags
          await applyTagAction(entityId, workspaceTagIds, workspaceId, userId);

          // Property: Tags exist in their designated scopes
          const result = await getEntityTagsAction(entityId, workspaceId);
          expect(result.success).toBe(true);
          expect(result.globalTags).toEqual(expect.arrayContaining(globalTagIds));
          expect(result.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));

          // Remove one global tag
          if (globalTagIds.length > 0) {
            await removeTagAction(entityId, [globalTagIds[0]], null, userId);

            // Property: Removal from global scope doesn't affect workspace scope
            const afterRemoval = await getEntityTagsAction(entityId, workspaceId);
            expect(afterRemoval.success).toBe(true);
            expect(afterRemoval.globalTags).not.toContain(globalTagIds[0]);
            expect(afterRemoval.workspaceTags).toEqual(expect.arrayContaining(workspaceTagIds));
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
