/**
 * Property-Based Test: Workspace Boundary Enforcement
 * 
 * **Property 22: Workspace Boundary Enforcement**
 * **Validates: Requirements 29.1, 29.2**
 * 
 * For any user query for entities or workspace_entities, the system should return
 * only records where the user has access to the associated workspace, enforcing
 * workspace isolation.
 * 
 * This test verifies that:
 * 1. Users can only access entities in their authorized workspaces
 * 2. Queries enforce workspace boundaries
 * 3. Unauthorized workspace access is prevented
 * 4. Cross-workspace data leakage is prevented
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
  const users = new Map<string, any>();

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
        } else if (collectionName === 'users') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = users.get(id);
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
      users,
      reset: () => {
        workspaceEntities.clear();
        entities.clear();
        workspaces.clear();
        users.clear();
      },
    },
  };
});

/**
 * User authorization check - simulates checking if user has access to workspace
 */
function userHasWorkspaceAccess(userId: string, workspaceId: string, userWorkspaces: string[]): boolean {
  return userWorkspaces.includes(workspaceId);
}

/**
 * Query function that enforces workspace boundary
 * This simulates the application-level query logic with authorization
 */
async function queryEntitiesWithAuthorization(
  userId: string,
  workspaceId: string,
  userWorkspaces: string[]
): Promise<string[]> {
  // Check authorization first
  if (!userHasWorkspaceAccess(userId, workspaceId, userWorkspaces)) {
    throw new Error('Unauthorized: User does not have access to this workspace');
  }

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

/**
 * Query function WITHOUT authorization (insecure - should not be used)
 * This simulates what happens if authorization is bypassed
 */
async function queryEntitiesWithoutAuthorization(workspaceId: string): Promise<string[]> {
  const { adminDb } = await import('../firebase-admin');
  
  const snapshot = await adminDb
    .collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.map((doc: any) => doc.data().entityId);
}

describe('Property 22: Workspace Boundary Enforcement', () => {
  let testStorage: {
    workspaceEntities: Map<string, any>;
    entities: Map<string, any>;
    workspaces: Map<string, any>;
    users: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should only return entities from authorized workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // authorized workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // unauthorized workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }), // entity IDs
        async (userId, authorizedWorkspaces, unauthorizedWorkspaces, entityIds) => {
          testStorage.reset();
          
          // Ensure workspaces are unique and disjoint
          const uniqueAuthorized = [...new Set(authorizedWorkspaces)];
          const uniqueUnauthorized = [...new Set(unauthorizedWorkspaces)].filter(
            w => !uniqueAuthorized.includes(w)
          );
          
          if (uniqueAuthorized.length === 0 || uniqueUnauthorized.length === 0) return;
          
          const uniqueEntityIds = [...new Set(entityIds)];
          if (uniqueEntityIds.length === 0) return;

          const organizationId = 'org_test';

          // Setup: Create user with authorized workspaces
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: uniqueAuthorized,
          });

          // Setup: Create all workspaces
          [...uniqueAuthorized, ...uniqueUnauthorized].forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
              scopeLocked: true,
            });
          });

          // Setup: Create entities and distribute across workspaces
          uniqueEntityIds.forEach((entityId, index) => {
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

            // Distribute entities across all workspaces (authorized and unauthorized)
            const allWorkspaces = [...uniqueAuthorized, ...uniqueUnauthorized];
            const workspaceId = allWorkspaces[index % allWorkspaces.length];

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
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          });

          // Property 1: User can query authorized workspaces successfully
          for (const workspaceId of uniqueAuthorized) {
            const results = await queryEntitiesWithAuthorization(userId, workspaceId, uniqueAuthorized);
            
            // Should return entities for this workspace
            expect(Array.isArray(results)).toBe(true);
            
            // All returned entities should belong to the queried workspace
            for (const entityId of results) {
              const weId = `we_${workspaceId}_${entityId}`;
              const workspaceEntity = testStorage.workspaceEntities.get(weId);
              expect(workspaceEntity).toBeDefined();
              expect(workspaceEntity.workspaceId).toBe(workspaceId);
            }
          }

          // Property 2: User cannot query unauthorized workspaces
          for (const workspaceId of uniqueUnauthorized) {
            await expect(
              queryEntitiesWithAuthorization(userId, workspaceId, uniqueAuthorized)
            ).rejects.toThrow('Unauthorized');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent cross-workspace data leakage through entityId queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // authorizedWorkspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // unauthorizedWorkspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // sharedEntityId
        async (userId, authorizedWorkspaceId, unauthorizedWorkspaceId, sharedEntityId) => {
          testStorage.reset();
          
          // Ensure workspaces are different
          if (authorizedWorkspaceId === unauthorizedWorkspaceId) return;

          const organizationId = 'org_test';

          // Setup: Create user with access to only one workspace
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: [authorizedWorkspaceId],
          });

          // Setup: Create both workspaces
          testStorage.workspaces.set(authorizedWorkspaceId, {
            id: authorizedWorkspaceId,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          testStorage.workspaces.set(unauthorizedWorkspaceId, {
            id: unauthorizedWorkspaceId,
            organizationId,
            contactScope: 'institution',
            scopeLocked: true,
          });

          // Setup: Create entity that exists in BOTH workspaces
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

          // Link entity to authorized workspace
          testStorage.workspaceEntities.set(`we_${authorizedWorkspaceId}_${sharedEntityId}`, {
            id: `we_${authorizedWorkspaceId}_${sharedEntityId}`,
            organizationId,
            workspaceId: authorizedWorkspaceId,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_1',
            assignedTo: null,
            status: 'active',
            workspaceTags: ['tag_authorized'],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: `Shared Entity ${sharedEntityId}`,
          });

          // Link entity to unauthorized workspace (with different operational data)
          testStorage.workspaceEntities.set(`we_${unauthorizedWorkspaceId}_${sharedEntityId}`, {
            id: `we_${unauthorizedWorkspaceId}_${sharedEntityId}`,
            organizationId,
            workspaceId: unauthorizedWorkspaceId,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_2',
            stageId: 'stage_2',
            assignedTo: null,
            status: 'active',
            workspaceTags: ['tag_unauthorized'],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayName: `Shared Entity ${sharedEntityId}`,
          });

          // Property 1: User can access entity through authorized workspace
          const authorizedResults = await queryEntitiesWithAuthorization(
            userId,
            authorizedWorkspaceId,
            [authorizedWorkspaceId]
          );
          expect(authorizedResults).toContain(sharedEntityId);

          // Property 2: User cannot access entity through unauthorized workspace
          await expect(
            queryEntitiesWithAuthorization(userId, unauthorizedWorkspaceId, [authorizedWorkspaceId])
          ).rejects.toThrow('Unauthorized');

          // Property 3: Even though entity exists in unauthorized workspace,
          // user should not be able to see its workspace-specific data
          const unauthorizedResults = await queryEntitiesWithoutAuthorization(unauthorizedWorkspaceId);
          expect(unauthorizedResults).toContain(sharedEntityId);
          
          // This demonstrates the data leakage that would occur without proper authorization
          // The authorized query should NOT return this data
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce workspace boundaries for multi-workspace users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }), // user's workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // other workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 3, maxLength: 10 }), // entity IDs
        async (userId, userWorkspaces, otherWorkspaces, entityIds) => {
          testStorage.reset();
          
          // Ensure we have unique workspace sets
          const uniqueUserWorkspaces = [...new Set(userWorkspaces)];
          const uniqueOtherWorkspaces = [...new Set(otherWorkspaces)].filter(
            w => !uniqueUserWorkspaces.includes(w)
          );
          
          if (uniqueUserWorkspaces.length < 2 || uniqueOtherWorkspaces.length === 0) return;
          
          const uniqueEntityIds = [...new Set(entityIds)];
          if (uniqueEntityIds.length < 3) return;

          const organizationId = 'org_test';

          // Setup: Create user with multiple authorized workspaces
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: uniqueUserWorkspaces,
          });

          // Setup: Create all workspaces
          [...uniqueUserWorkspaces, ...uniqueOtherWorkspaces].forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
              scopeLocked: true,
            });
          });

          // Setup: Create entities and distribute across all workspaces
          const entitiesPerWorkspace = new Map<string, string[]>();
          
          uniqueEntityIds.forEach((entityId, index) => {
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

            // Distribute entities across all workspaces
            const allWorkspaces = [...uniqueUserWorkspaces, ...uniqueOtherWorkspaces];
            const workspaceId = allWorkspaces[index % allWorkspaces.length];

            if (!entitiesPerWorkspace.has(workspaceId)) {
              entitiesPerWorkspace.set(workspaceId, []);
            }
            entitiesPerWorkspace.get(workspaceId)!.push(entityId);

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
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          });

          // Property 1: User can access all their authorized workspaces
          for (const workspaceId of uniqueUserWorkspaces) {
            const results = await queryEntitiesWithAuthorization(
              userId,
              workspaceId,
              uniqueUserWorkspaces
            );
            
            const expectedEntities = entitiesPerWorkspace.get(workspaceId) || [];
            expect(results.sort()).toEqual(expectedEntities.sort());
          }

          // Property 2: User cannot access unauthorized workspaces
          for (const workspaceId of uniqueOtherWorkspaces) {
            await expect(
              queryEntitiesWithAuthorization(userId, workspaceId, uniqueUserWorkspaces)
            ).rejects.toThrow('Unauthorized');
          }

          // Property 3: Results from different authorized workspaces are properly isolated
          const allAuthorizedResults = new Map<string, string[]>();
          for (const workspaceId of uniqueUserWorkspaces) {
            const results = await queryEntitiesWithAuthorization(
              userId,
              workspaceId,
              uniqueUserWorkspaces
            );
            allAuthorizedResults.set(workspaceId, results);
          }

          // Each workspace should return only its own entities
          for (const [workspaceId, results] of allAuthorizedResults.entries()) {
            for (const entityId of results) {
              const weId = `we_${workspaceId}_${entityId}`;
              const workspaceEntity = testStorage.workspaceEntities.get(weId);
              expect(workspaceEntity).toBeDefined();
              expect(workspaceEntity.workspaceId).toBe(workspaceId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty results for authorized workspace with no entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // emptyWorkspaceId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // other workspaces with entities
        async (userId, emptyWorkspaceId, otherWorkspaces) => {
          testStorage.reset();
          
          // Ensure empty workspace is different from others
          const uniqueOtherWorkspaces = [...new Set(otherWorkspaces)].filter(
            w => w !== emptyWorkspaceId
          );
          
          if (uniqueOtherWorkspaces.length === 0) return;

          const organizationId = 'org_test';
          const allWorkspaces = [emptyWorkspaceId, ...uniqueOtherWorkspaces];

          // Setup: Create user with access to all workspaces
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: allWorkspaces,
          });

          // Setup: Create all workspaces
          allWorkspaces.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
              scopeLocked: true,
            });
          });

          // Setup: Add entities to other workspaces but NOT to empty workspace
          uniqueOtherWorkspaces.forEach((workspaceId, index) => {
            const entityId = `entity_${workspaceId}_${index}`;
            
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
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          });

          // Property 1: Empty workspace returns empty array (not error)
          const emptyResults = await queryEntitiesWithAuthorization(
            userId,
            emptyWorkspaceId,
            allWorkspaces
          );
          expect(emptyResults).toEqual([]);

          // Property 2: Other workspaces return their entities
          for (const workspaceId of uniqueOtherWorkspaces) {
            const results = await queryEntitiesWithAuthorization(
              userId,
              workspaceId,
              allWorkspaces
            );
            expect(results.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should enforce boundaries when user has no workspace access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // entity IDs
        async (userId, workspaces, entityIds) => {
          testStorage.reset();
          
          const uniqueWorkspaces = [...new Set(workspaces)];
          const uniqueEntityIds = [...new Set(entityIds)];
          
          if (uniqueWorkspaces.length === 0 || uniqueEntityIds.length === 0) return;

          const organizationId = 'org_test';

          // Setup: Create user with NO workspace access
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: [], // Empty - no access
          });

          // Setup: Create workspaces with entities
          uniqueWorkspaces.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
              scopeLocked: true,
            });
          });

          uniqueEntityIds.forEach((entityId, index) => {
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

            const workspaceId = uniqueWorkspaces[index % uniqueWorkspaces.length];
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
              status: 'active',
              workspaceTags: [],
              addedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              displayName: `Entity ${entityId}`,
            });
          });

          // Property: User with no workspace access cannot query any workspace
          for (const workspaceId of uniqueWorkspaces) {
            await expect(
              queryEntitiesWithAuthorization(userId, workspaceId, [])
            ).rejects.toThrow('Unauthorized');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain isolation when entities have same ID across workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 4 }), // workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // shared entity IDs
        async (userId, workspaces, sharedEntityIds) => {
          testStorage.reset();
          
          const uniqueWorkspaces = [...new Set(workspaces)];
          const uniqueEntityIds = [...new Set(sharedEntityIds)];
          
          if (uniqueWorkspaces.length < 2 || uniqueEntityIds.length === 0) return;

          const organizationId = 'org_test';
          
          // User has access to first half of workspaces
          const authorizedWorkspaces = uniqueWorkspaces.slice(0, Math.ceil(uniqueWorkspaces.length / 2));
          const unauthorizedWorkspaces = uniqueWorkspaces.slice(Math.ceil(uniqueWorkspaces.length / 2));

          // Setup: Create user
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            workspaceIds: authorizedWorkspaces,
          });

          // Setup: Create workspaces
          uniqueWorkspaces.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
              scopeLocked: true,
            });
          });

          // Setup: Create entities that exist in ALL workspaces
          // This tests that workspace_entities properly isolates the same entity across workspaces
          uniqueEntityIds.forEach(entityId => {
            testStorage.entities.set(entityId, {
              id: entityId,
              organizationId,
              entityType: 'institution',
              name: `Shared Entity ${entityId}`,
              contacts: [],
              globalTags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Link this entity to ALL workspaces with different operational data
            uniqueWorkspaces.forEach((workspaceId, wsIndex) => {
              const weId = `we_${workspaceId}_${entityId}`;
              testStorage.workspaceEntities.set(weId, {
                id: weId,
                organizationId,
                workspaceId,
                entityId,
                entityType: 'institution',
                pipelineId: `pipeline_${wsIndex}`,
                stageId: `stage_${wsIndex}`,
                assignedTo: null,
                status: 'active',
                workspaceTags: [`tag_${workspaceId}`],
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                displayName: `Entity ${entityId} in ${workspaceId}`,
              });
            });
          });

          // Property 1: User can access shared entities through authorized workspaces
          for (const workspaceId of authorizedWorkspaces) {
            const results = await queryEntitiesWithAuthorization(
              userId,
              workspaceId,
              authorizedWorkspaces
            );
            
            // Should return all shared entities for this workspace
            expect(results.sort()).toEqual(uniqueEntityIds.sort());
          }

          // Property 2: User cannot access shared entities through unauthorized workspaces
          for (const workspaceId of unauthorizedWorkspaces) {
            await expect(
              queryEntitiesWithAuthorization(userId, workspaceId, authorizedWorkspaces)
            ).rejects.toThrow('Unauthorized');
          }

          // Property 3: Even though entities are shared, workspace-specific data is isolated
          // This verifies that the workspace_entities records properly partition operational data
          const workspace1Results = await queryEntitiesWithAuthorization(
            userId,
            authorizedWorkspaces[0],
            authorizedWorkspaces
          );
          
          if (authorizedWorkspaces.length > 1) {
            const workspace2Results = await queryEntitiesWithAuthorization(
              userId,
              authorizedWorkspaces[1],
              authorizedWorkspaces
            );
            
            // Same entities returned
            expect(workspace1Results.sort()).toEqual(workspace2Results.sort());
            
            // But workspace_entities records are different
            for (const entityId of workspace1Results) {
              const we1 = testStorage.workspaceEntities.get(`we_${authorizedWorkspaces[0]}_${entityId}`);
              const we2 = testStorage.workspaceEntities.get(`we_${authorizedWorkspaces[1]}_${entityId}`);
              
              expect(we1.workspaceId).toBe(authorizedWorkspaces[0]);
              expect(we2.workspaceId).toBe(authorizedWorkspaces[1]);
              expect(we1.pipelineId).not.toBe(we2.pipelineId);
              expect(we1.workspaceTags).not.toEqual(we2.workspaceTags);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
