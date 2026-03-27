/**
 * Property-Based Test: Workspace Query Isolation
 * 
 * **Property 8: Workspace Query Isolation**
 * **Validates: Requirements 9**
 * 
 * For any two workspaces W1 and W2 in the same organization:
 * - queryContacts(W1) ∩ queryContacts(W2) = ∅ when no entity belongs to both workspaces
 * 
 * This test populates two workspaces with disjoint entity sets and asserts that
 * querying one workspace never returns entities from the other.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

// Mock Firestore
vi.mock('../firebase-admin', () => {
  // In-memory storage for testing
  const workspaceEntities = new Map<string, any>();
  const entities = new Map<string, any>();
  const workspaces = new Map<string, any>();

  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn((field1: string, op1: string, value1: any) => {
              return {
                where: vi.fn((field2: string, op2: string, value2: any) => {
                  return {
                    get: vi.fn().mockImplementation(async () => {
                      const results: any[] = [];
                      
                      // Apply both filters - must match ALL conditions
                      workspaceEntities.forEach((data, id) => {
                        let matchesFirst = false;
                        let matchesSecond = false;
                        
                        // Check first filter
                        if (field1 === 'workspaceId' && op1 === '==') {
                          matchesFirst = data.workspaceId === value1;
                        } else if (field1 === 'status' && op1 === '==') {
                          matchesFirst = data.status === value1;
                        }
                        
                        // Check second filter
                        if (field2 === 'workspaceId' && op2 === '==') {
                          matchesSecond = data.workspaceId === value2;
                        } else if (field2 === 'status' && op2 === '==') {
                          matchesSecond = data.status === value2;
                        }
                        
                        // Only include if BOTH filters match
                        if (matchesFirst && matchesSecond) {
                          results.push({ id, data: () => data, exists: true });
                        }
                      });
                      
                      return {
                        empty: results.length === 0,
                        docs: results,
                        size: results.length,
                      };
                    }),
                  };
                }),
                get: vi.fn().mockImplementation(async () => {
                  const results: any[] = [];
                  
                  // Apply single filter
                  workspaceEntities.forEach((data, id) => {
                    let matches = false;
                    
                    if (field1 === 'workspaceId' && op1 === '==') {
                      matches = data.workspaceId === value1;
                    } else if (field1 === 'status' && op1 === '==') {
                      matches = data.status === value1;
                    }
                    
                    if (matches) {
                      results.push({ id, data: () => data, exists: true });
                    }
                  });
                  
                  return {
                    empty: results.length === 0,
                    docs: results,
                    size: results.length,
                  };
                }),
              };
            }),
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaceEntities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
          };
        } else if (collectionName === 'entities') {
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
          };
        } else if (collectionName === 'workspaces') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaces.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
          };
        }
        return {};
      }),
    },
    // Expose storage for test setup
    __testStorage: {
      workspaceEntities,
      entities,
      workspaces,
      reset: () => {
        workspaceEntities.clear();
        entities.clear();
        workspaces.clear();
      },
    },
  };
});

/**
 * Query function that simulates workspace-scoped contact queries
 * This mimics the application-level query logic that should be used
 */
async function queryContactsByWorkspace(workspaceId: string): Promise<string[]> {
  const { adminDb } = await import('../firebase-admin');
  
  // Query workspace_entities filtered by workspaceId and status
  const snapshot = await adminDb
    .collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('status', '==', 'active')
    .get();

  // Return entity IDs
  return snapshot.docs.map((doc: any) => doc.data().entityId);
}

describe('Property 8: Workspace Query Isolation', () => {
  let testStorage: {
    workspaceEntities: Map<string, any>;
    entities: Map<string, any>;
    workspaces: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should return disjoint entity sets when querying different workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // entities for W1
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // entities for W2
        async (workspace1Id, workspace2Id, entities1, entities2) => {
          // Reset storage for this property test run
          testStorage.reset();
          
          // Ensure workspaces are different
          if (workspace1Id === workspace2Id) return;

          // Ensure entity sets are disjoint (no overlap)
          const uniqueEntities1 = [...new Set(entities1)];
          const uniqueEntities2 = [...new Set(entities2)];
          
          // Skip if either set is empty
          if (uniqueEntities1.length === 0 || uniqueEntities2.length === 0) return;
          
          const overlap = uniqueEntities1.filter(e => uniqueEntities2.includes(e));
          if (overlap.length > 0) return;

          const organizationId = 'org_test';

          // Setup: Create workspaces
          testStorage.workspaces.set(workspace1Id, {
            id: workspace1Id,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          testStorage.workspaces.set(workspace2Id, {
            id: workspace2Id,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          // Setup: Create entities for workspace 1
          for (const entityId of uniqueEntities1) {
            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            const weId = `we_${workspace1Id}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId: workspace1Id,
              entityId,
              entityType: 'institution',
              pipelineId: 'pipeline_1',
              stageId: 'stage_1',
              assignedTo: null,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          }

          // Setup: Create entities for workspace 2
          for (const entityId of uniqueEntities2) {
            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            const weId = `we_${workspace2Id}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId: workspace2Id,
              entityId,
              entityType: 'institution',
              pipelineId: 'pipeline_1',
              stageId: 'stage_1',
              assignedTo: null,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          }

          // Action: Query both workspaces
          const results1 = await queryContactsByWorkspace(workspace1Id);
          const results2 = await queryContactsByWorkspace(workspace2Id);

          // Property: Results should match the entity sets we created
          expect(results1.sort()).toEqual(uniqueEntities1.sort());
          expect(results2.sort()).toEqual(uniqueEntities2.sort());

          // Property: Results should be disjoint (no overlap)
          const intersection = results1.filter(e => results2.includes(e));
          expect(intersection).toEqual([]);

          // Property: Querying W1 should never return entities from W2
          for (const entityId of results1) {
            expect(uniqueEntities2).not.toContain(entityId);
          }

          // Property: Querying W2 should never return entities from W1
          for (const entityId of results2) {
            expect(uniqueEntities1).not.toContain(entityId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only return active entities for a workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }), // entityIds
        async (workspaceId, entityIds) => {
          // Reset storage for this property test run
          testStorage.reset();
          
          // Ensure we have at least 2 unique entities
          const uniqueEntityIds = [...new Set(entityIds)];
          if (uniqueEntityIds.length < 2) return;

          const organizationId = 'org_test';

          // Setup: Create workspace
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          // Setup: Create entities - half active, half archived
          const activeEntities: string[] = [];
          const archivedEntities: string[] = [];

          uniqueEntityIds.forEach((entityId, index) => {
            const isActive = index % 2 === 0;
            const status = isActive ? 'active' : 'archived';

            if (isActive) {
              activeEntities.push(entityId);
            } else {
              archivedEntities.push(entityId);
            }

            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              status,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            const weId = `we_${workspaceId}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId,
              entityId,
              entityType: 'institution',
              pipelineId: 'pipeline_1',
              stageId: 'stage_1',
              assignedTo: null,
              status,
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          });

          // Action: Query workspace
          const results = await queryContactsByWorkspace(workspaceId);

          // Property: Should only return active entities
          expect(results.sort()).toEqual(activeEntities.sort());

          // Property: Should not return archived entities
          for (const archivedId of archivedEntities) {
            expect(results).not.toContain(archivedId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when workspace has no entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        async (workspaceId) => {
          // Reset storage for this property test run
          testStorage.reset();
          
          const organizationId = 'org_test';

          // Setup: Create workspace with no entities
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
            scopeLocked: false,
          });

          // Action: Query workspace
          const results = await queryContactsByWorkspace(workspaceId);

          // Property: Should return empty array
          expect(results).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain isolation when entity belongs to multiple workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.string({ minLength: 1, maxLength: 20 }), // sharedEntityId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // exclusive entities for W1
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // exclusive entities for W2
        async (workspace1Id, workspace2Id, sharedEntityId, exclusiveEntities1, exclusiveEntities2) => {
          // Reset storage for this property test run
          testStorage.reset();
          
          // Ensure workspaces are different
          if (workspace1Id === workspace2Id) return;

          // Ensure exclusive entity sets don't overlap with each other or shared entity
          const uniqueExclusive1 = [...new Set(exclusiveEntities1)].filter(e => e !== sharedEntityId);
          const uniqueExclusive2 = [...new Set(exclusiveEntities2)].filter(e => e !== sharedEntityId);
          
          // Skip if either exclusive set is empty
          if (uniqueExclusive1.length === 0 || uniqueExclusive2.length === 0) return;
          
          const overlap = uniqueExclusive1.filter(e => uniqueExclusive2.includes(e));
          if (overlap.length > 0) return;

          const organizationId = 'org_test';

          // Setup: Create workspaces
          testStorage.workspaces.set(workspace1Id, {
            id: workspace1Id,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          testStorage.workspaces.set(workspace2Id, {
            id: workspace2Id,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          // Setup: Create shared entity
          testStorage.entities.set(sharedEntityId, {
            id: sharedEntityId,
            organizationId,
            entityType: 'institution',
            name: `Shared Entity ${sharedEntityId}`,
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Link shared entity to both workspaces
          testStorage.workspaceEntities.set(`we_${workspace1Id}_${sharedEntityId}`, {
            id: `we_${workspace1Id}_${sharedEntityId}`,
            organizationId,
            workspaceId: workspace1Id,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_1',
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: `Shared Entity ${sharedEntityId}`,
          });

          testStorage.workspaceEntities.set(`we_${workspace2Id}_${sharedEntityId}`, {
            id: `we_${workspace2Id}_${sharedEntityId}`,
            organizationId,
            workspaceId: workspace2Id,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_2',
            assignedTo: null,
            status: 'active',
            workspaceTags: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: `Shared Entity ${sharedEntityId}`,
          });

          // Setup: Create exclusive entities for workspace 1
          for (const entityId of uniqueExclusive1) {
            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            testStorage.workspaceEntities.set(`we_${workspace1Id}_${entityId}`, {
              id: `we_${workspace1Id}_${entityId}`,
              organizationId,
              workspaceId: workspace1Id,
              entityId,
              entityType: 'institution',
              pipelineId: 'pipeline_1',
              stageId: 'stage_1',
              assignedTo: null,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          }

          // Setup: Create exclusive entities for workspace 2
          for (const entityId of uniqueExclusive2) {
            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            testStorage.workspaceEntities.set(`we_${workspace2Id}_${entityId}`, {
              id: `we_${workspace2Id}_${entityId}`,
              organizationId,
              workspaceId: workspace2Id,
              entityId,
              entityType: 'institution',
              pipelineId: 'pipeline_1',
              stageId: 'stage_1',
              assignedTo: null,
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          }

          // Action: Query both workspaces
          const results1 = await queryContactsByWorkspace(workspace1Id);
          const results2 = await queryContactsByWorkspace(workspace2Id);

          // Property: Both workspaces should include the shared entity
          expect(results1).toContain(sharedEntityId);
          expect(results2).toContain(sharedEntityId);

          // Property: W1 should include shared entity + exclusive entities for W1
          const expectedW1 = [sharedEntityId, ...uniqueExclusive1].sort();
          expect(results1.sort()).toEqual(expectedW1);

          // Property: W2 should include shared entity + exclusive entities for W2
          const expectedW2 = [sharedEntityId, ...uniqueExclusive2].sort();
          expect(results2.sort()).toEqual(expectedW2);

          // Property: W1 should not include exclusive entities from W2
          for (const entityId of uniqueExclusive2) {
            expect(results1).not.toContain(entityId);
          }

          // Property: W2 should not include exclusive entities from W1
          for (const entityId of uniqueExclusive1) {
            expect(results2).not.toContain(entityId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
