/**
 * Unit Tests for Workspace-Scoped Tag Filtering
 * 
 * Tests the implementation of Requirement 7 (Global vs. Workspace Tag Separation)
 * and Requirement 8 (Workspace-Scoped Queries)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEntitiesByTagsAction, getCombinedEntityTagsAction } from '../workspace-tag-filtering';

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
            })),
            where: vi.fn((field: string, op: string, value: any) => {
              return {
                get: vi.fn().mockImplementation(async () => {
                  let results = Array.from(entities.entries());
                  
                  if (field === 'globalTags' && op === 'array-contains-any') {
                    results = results.filter(([id, data]) => {
                      const globalTags = data.globalTags || [];
                      return value.some((tag: string) => globalTags.includes(tag));
                    });
                  } else if (field === 'globalTags' && op === 'array-contains') {
                    results = results.filter(([id, data]) => {
                      const globalTags = data.globalTags || [];
                      return globalTags.includes(value);
                    });
                  }
                  
                  return {
                    docs: results.map(([id, data]) => ({
                      id,
                      data: () => data,
                    })),
                  };
                }),
              };
            }),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn((field: string, op: string, value: any) => {
              const filters: Array<{ field: string; op: string; value: any }> = [{ field, op, value }];
              
              const applyFilters = (results: any[]) => {
                for (const filter of filters) {
                  results = results.filter((we: any) => {
                    if (filter.op === '==') {
                      return we[filter.field] === filter.value;
                    } else if (filter.op === 'array-contains-any') {
                      const arr = we[filter.field] || [];
                      return filter.value.some((v: any) => arr.includes(v));
                    } else if (filter.op === 'array-contains') {
                      const arr = we[filter.field] || [];
                      return arr.includes(filter.value);
                    }
                    return true;
                  });
                }
                return results;
              };
              
              return {
                where: vi.fn((field2: string, op2: string, value2: any) => {
                  filters.push({ field: field2, op: op2, value: value2 });
                  return {
                    limit: vi.fn(() => ({
                      get: vi.fn().mockImplementation(async () => {
                        let results = Array.from(workspaceEntities.values());
                        results = applyFilters(results);
                        
                        return {
                          empty: results.length === 0,
                          docs: results.map((data: any) => ({
                            id: data.id,
                            data: () => data,
                          })),
                        };
                      }),
                    })),
                    get: vi.fn().mockImplementation(async () => {
                      let results = Array.from(workspaceEntities.values());
                      results = applyFilters(results);
                      
                      return {
                        empty: results.length === 0,
                        docs: results.map((data: any) => ({
                          id: data.id,
                          data: () => data,
                        })),
                      };
                    }),
                  };
                }),
                get: vi.fn().mockImplementation(async () => {
                  let results = Array.from(workspaceEntities.values());
                  results = applyFilters(results);
                  
                  return {
                    empty: results.length === 0,
                    docs: results.map((data: any) => ({
                      id: data.id,
                      data: () => data,
                    })),
                  };
                }),
              };
            }),
          };
        } else if (collectionName === 'tags') {
          return {
            where: vi.fn(() => ({
              get: vi.fn().mockImplementation(async () => ({
                docs: Array.from(tags.values()).map((data: any) => ({
                  id: data.id,
                  data: () => data,
                })),
              })),
            })),
          };
        }
        return {};
      }),
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

describe('Workspace-Scoped Tag Filtering', () => {
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

  describe('getEntitiesByTagsAction - workspace scope', () => {
    it('should filter entities by workspace tags with OR logic', async () => {
      // Setup
      const workspaceId = 'workspace-1';
      const entityId1 = 'entity-1';
      const entityId2 = 'entity-2';
      const entityId3 = 'entity-3';
      const tag1 = 'tag-1';
      const tag2 = 'tag-2';

      testStorage.workspaceEntities.set('we-1', {
        id: 'we-1',
        entityId: entityId1,
        workspaceId,
        workspaceTags: [tag1],
      });

      testStorage.workspaceEntities.set('we-2', {
        id: 'we-2',
        entityId: entityId2,
        workspaceId,
        workspaceTags: [tag2],
      });

      testStorage.workspaceEntities.set('we-3', {
        id: 'we-3',
        entityId: entityId3,
        workspaceId,
        workspaceTags: [],
      });

      // Execute
      const result = await getEntitiesByTagsAction(
        workspaceId,
        { tagIds: [tag1, tag2], logic: 'OR' },
        'workspace'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toContain(entityId1);
      expect(result.data).toContain(entityId2);
      expect(result.data).not.toContain(entityId3);
    });

    it('should filter entities by workspace tags with AND logic', async () => {
      // Setup
      const workspaceId = 'workspace-1';
      const entityId1 = 'entity-1';
      const entityId2 = 'entity-2';
      const tag1 = 'tag-1';
      const tag2 = 'tag-2';

      testStorage.workspaceEntities.set('we-1', {
        id: 'we-1',
        entityId: entityId1,
        workspaceId,
        workspaceTags: [tag1, tag2],
      });

      testStorage.workspaceEntities.set('we-2', {
        id: 'we-2',
        entityId: entityId2,
        workspaceId,
        workspaceTags: [tag1],
      });

      // Execute
      const result = await getEntitiesByTagsAction(
        workspaceId,
        { tagIds: [tag1, tag2], logic: 'AND' },
        'workspace'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data).toContain(entityId1);
      expect(result.data).not.toContain(entityId2);
    });

    it('should filter entities by workspace tags with NOT logic', async () => {
      // Setup
      const workspaceId = 'workspace-1';
      const entityId1 = 'entity-1';
      const entityId2 = 'entity-2';
      const entityId3 = 'entity-3';
      const tag1 = 'tag-1';

      testStorage.workspaceEntities.set('we-1', {
        id: 'we-1',
        entityId: entityId1,
        workspaceId,
        workspaceTags: [tag1],
      });

      testStorage.workspaceEntities.set('we-2', {
        id: 'we-2',
        entityId: entityId2,
        workspaceId,
        workspaceTags: [],
      });

      testStorage.workspaceEntities.set('we-3', {
        id: 'we-3',
        entityId: entityId3,
        workspaceId,
        workspaceTags: ['other-tag'],
      });

      // Execute
      const result = await getEntitiesByTagsAction(
        workspaceId,
        { tagIds: [tag1], logic: 'NOT' },
        'workspace'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).not.toContain(entityId1);
      expect(result.data).toContain(entityId2);
      expect(result.data).toContain(entityId3);
    });
  });

  describe('getCombinedEntityTagsAction', () => {
    it('should return both global and workspace tags with scope indicators', async () => {
      // Setup
      const entityId = 'entity-1';
      const workspaceId = 'workspace-1';
      const globalTag1 = 'global-tag-1';
      const globalTag2 = 'global-tag-2';
      const workspaceTag1 = 'workspace-tag-1';
      const workspaceTag2 = 'workspace-tag-2';

      testStorage.entities.set(entityId, {
        id: entityId,
        organizationId: 'org-1',
        entityType: 'institution',
        name: 'Test Entity',
        globalTags: [globalTag1, globalTag2],
        contacts: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      });

      testStorage.workspaceEntities.set('we-1', {
        id: 'we-1',
        entityId,
        workspaceId,
        workspaceTags: [workspaceTag1, workspaceTag2],
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

      testStorage.tags.set(globalTag1, { id: globalTag1, name: 'Global Tag 1' });
      testStorage.tags.set(globalTag2, { id: globalTag2, name: 'Global Tag 2' });
      testStorage.tags.set(workspaceTag1, { id: workspaceTag1, name: 'Workspace Tag 1' });
      testStorage.tags.set(workspaceTag2, { id: workspaceTag2, name: 'Workspace Tag 2' });

      // Execute
      const result = await getCombinedEntityTagsAction(entityId, workspaceId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.globalTags).toHaveLength(2);
      expect(result.workspaceTags).toHaveLength(2);

      expect(result.globalTags?.[0].scope).toBe('global');
      expect(result.globalTags?.[1].scope).toBe('global');
      expect(result.workspaceTags?.[0].scope).toBe('workspace');
      expect(result.workspaceTags?.[1].scope).toBe('workspace');

      expect(result.globalTags?.map(t => t.id)).toContain(globalTag1);
      expect(result.globalTags?.map(t => t.id)).toContain(globalTag2);
      expect(result.workspaceTags?.map(t => t.id)).toContain(workspaceTag1);
      expect(result.workspaceTags?.map(t => t.id)).toContain(workspaceTag2);
    });

    it('should handle entities with no workspace tags', async () => {
      // Setup
      const entityId = 'entity-1';
      const workspaceId = 'workspace-1';
      const globalTag1 = 'global-tag-1';

      testStorage.entities.set(entityId, {
        id: entityId,
        organizationId: 'org-1',
        entityType: 'institution',
        name: 'Test Entity',
        globalTags: [globalTag1],
        contacts: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      });

      testStorage.workspaceEntities.set('we-1', {
        id: 'we-1',
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

      testStorage.tags.set(globalTag1, { id: globalTag1, name: 'Global Tag 1' });

      // Execute
      const result = await getCombinedEntityTagsAction(entityId, workspaceId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.globalTags).toHaveLength(1);
      expect(result.workspaceTags).toHaveLength(0);
    });
  });
});
