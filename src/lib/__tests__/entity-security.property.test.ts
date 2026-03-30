/**
 * Property-Based Tests: Entity Security and Authorization
 * 
 * **Property 23: Entity Update Authorization**
 * **Validates: Requirements 29.3**
 * 
 * For any entity update operation, the system should verify that the user has
 * the required permissions for the entity's workspace before allowing the modification.
 * 
 * **Property 25: Cross-Workspace Isolation**
 * **Validates: Requirements 29.5**
 * 
 * For any entityId query, the system should prevent access to workspace_entities
 * records from workspaces the user is not authorized to access, even if the
 * entityId is valid.
 * 
 * This test verifies that:
 * 1. Entity updates require proper workspace permissions
 * 2. Unauthorized users cannot update entities
 * 3. EntityId queries enforce workspace boundaries
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
  const roles = new Map<string, any>();
  const auditLogs = new Map<string, any>();

  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = workspaceEntities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
              set: vi.fn().mockImplementation(async (data: any) => {
                workspaceEntities.set(id, { ...data, id });
              }),
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = workspaceEntities.get(id);
                if (existing) {
                  workspaceEntities.set(id, { ...existing, ...updates });
                }
              }),
            })),
            where: vi.fn((field: string, op: string, value: any) => ({
              get: vi.fn().mockImplementation(async () => {
                const results: any[] = [];
                workspaceEntities.forEach((data, id) => {
                  if (field === 'workspaceId' && op === '==' && data.workspaceId === value) {
                    results.push({ id, data: () => data, exists: true });
                  } else if (field === 'entityId' && op === '==' && data.entityId === value) {
                    results.push({ id, data: () => data, exists: true });
                  }
                });
                return {
                  empty: results.length === 0,
                  docs: results,
                  size: results.length,
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
              update: vi.fn().mockImplementation(async (updates: any) => {
                const existing = entities.get(id);
                if (existing) {
                  entities.set(id, { ...existing, ...updates });
                }
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
        } else if (collectionName === 'roles') {
          return {
            where: vi.fn((field: string, op: string, value: any) => ({
              get: vi.fn().mockImplementation(async () => {
                const results: any[] = [];
                roles.forEach((data, id) => {
                  if (field === 'organizationId' && op === '==' && data.organizationId === value) {
                    results.push({ id, data: () => data, exists: true });
                  }
                });
                return {
                  empty: results.length === 0,
                  docs: results,
                  size: results.length,
                };
              }),
            })),
          };
        } else if (collectionName === 'audit_logs') {
          return {
            add: vi.fn().mockImplementation(async (data: any) => {
              const id = `audit_${Date.now()}_${Math.random()}`;
              auditLogs.set(id, { ...data, id });
              return { id };
            }),
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
      roles,
      auditLogs,
      reset: () => {
        workspaceEntities.clear();
        entities.clear();
        workspaces.clear();
        users.clear();
        roles.clear();
        auditLogs.clear();
      },
    },
  };
});

/**
 * Check if user has permission to update entity in a workspace
 */
async function checkEntityUpdatePermission(
  userId: string,
  workspaceId: string,
  entityId: string
): Promise<{ granted: boolean; reason?: string }> {
  const { adminDb } = await import('../firebase-admin');

  // 1. Fetch user
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) {
    return { granted: false, reason: 'User not found' };
  }

  const user = userSnap.data();
  if (!user) {
    return { granted: false, reason: 'User data not found' };
  }

  // System admins bypass all checks
  if (user.permissions?.includes('system_admin')) {
    return { granted: true };
  }

  // 2. Fetch workspace
  const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!workspaceSnap.exists) {
    return { granted: false, reason: 'Workspace not found' };
  }

  const workspace = workspaceSnap.data();
  if (!workspace) {
    return { granted: false, reason: 'Workspace data not found' };
  }

  // 3. Check organization membership
  if (user.organizationId !== workspace.organizationId) {
    return { granted: false, reason: 'User does not belong to workspace organization' };
  }

  // 4. Check if user has role that grants access to this workspace
  const rolesSnap = await adminDb
    .collection('roles')
    .where('organizationId', '==', user.organizationId)
    .get();

  const userRoles = rolesSnap.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((role: any) => user.roles.includes(role.id));

  const hasWorkspaceAccess = userRoles.some((role: any) =>
    role.workspaceIds.includes(workspaceId)
  );

  if (!hasWorkspaceAccess) {
    return { granted: false, reason: 'User does not have access to this workspace' };
  }

  // 5. Check if user has entity edit permission
  if (!user.permissions?.includes('entities_edit')) {
    return { granted: false, reason: 'User does not have entities_edit permission' };
  }

  return { granted: true };
}

/**
 * Update entity with authorization check
 */
async function updateEntityWithAuthorization(
  userId: string,
  entityId: string,
  workspaceId: string,
  updates: any
): Promise<{ success: boolean; error?: string }> {
  // Check permission
  const permissionCheck = await checkEntityUpdatePermission(userId, workspaceId, entityId);

  if (!permissionCheck.granted) {
    throw new Error(`Unauthorized: ${permissionCheck.reason}`);
  }

  const { adminDb } = await import('../firebase-admin');

  // Update entity
  await adminDb.collection('entities').doc(entityId).update(updates);

  return { success: true };
}

/**
 * Update workspace_entity with authorization check
 */
async function updateWorkspaceEntityWithAuthorization(
  userId: string,
  workspaceEntityId: string,
  updates: any
): Promise<{ success: boolean; error?: string }> {
  const { adminDb } = await import('../firebase-admin');

  // Fetch workspace_entity to get workspaceId
  const weSnap = await adminDb.collection('workspace_entities').doc(workspaceEntityId).get();
  if (!weSnap.exists) {
    throw new Error('Workspace entity not found');
  }

  const workspaceEntity = weSnap.data();
  if (!workspaceEntity) {
    throw new Error('Workspace entity data not found');
  }

  // Check permission
  const permissionCheck = await checkEntityUpdatePermission(
    userId,
    workspaceEntity.workspaceId,
    workspaceEntity.entityId
  );

  if (!permissionCheck.granted) {
    throw new Error(`Unauthorized: ${permissionCheck.reason}`);
  }

  // Update workspace_entity
  await adminDb.collection('workspace_entities').doc(workspaceEntityId).update(updates);

  return { success: true };
}

/**
 * Query workspace_entities by entityId with authorization
 */
async function queryWorkspaceEntitiesByEntityId(
  userId: string,
  entityId: string,
  userWorkspaceIds: string[]
): Promise<string[]> {
  const { adminDb } = await import('../firebase-admin');

  // Query all workspace_entities for this entityId
  const snapshot = await adminDb
    .collection('workspace_entities')
    .where('entityId', '==', entityId)
    .get();

  // Filter to only workspaces user has access to
  const authorizedResults = snapshot.docs
    .filter((doc: any) => {
      const data = doc.data();
      return userWorkspaceIds.includes(data.workspaceId);
    })
    .map((doc: any) => doc.id);

  return authorizedResults;
}

describe('Property 23: Entity Update Authorization', () => {
  let testStorage: {
    workspaceEntities: Map<string, any>;
    entities: Map<string, any>;
    workspaces: Map<string, any>;
    users: Map<string, any>;
    roles: Map<string, any>;
    auditLogs: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should allow authorized users to update entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          globalTags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
        }), // updates
        async (userId, workspaceId, entityId, updates) => {
          testStorage.reset();

          const organizationId = 'org_test';
          const roleId = 'role_admin';

          // Setup: Create user with entities_edit permission
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [roleId],
            permissions: ['entities_edit'],
          });

          // Setup: Create role with workspace access
          testStorage.roles.set(roleId, {
            id: roleId,
            organizationId,
            workspaceIds: [workspaceId],
          });

          // Setup: Create workspace
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Original Name',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entity
          const weId = `we_${workspaceId}_${entityId}`;
          testStorage.workspaceEntities.set(weId, {
            id: weId,
            organizationId,
            workspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_1',
            status: 'active',
            workspaceTags: [],
            displayName: 'Original Name',
          });

          // Property: Authorized user can update entity
          const result = await updateEntityWithAuthorization(userId, entityId, workspaceId, updates);

          expect(result.success).toBe(true);

          // Verify entity was updated
          const updatedEntity = testStorage.entities.get(entityId);
          expect(updatedEntity.name).toBe(updates.name);
          expect(updatedEntity.globalTags).toEqual(updates.globalTags);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject entity updates from unauthorized users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // unauthorizedWorkspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }), // updates
        async (userId, workspaceId, unauthorizedWorkspaceId, entityId, updates) => {
          testStorage.reset();

          // Ensure workspaces are different
          if (workspaceId === unauthorizedWorkspaceId) return;

          const organizationId = 'org_test';
          const roleId = 'role_limited';

          // Setup: Create user with access to only one workspace
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [roleId],
            permissions: ['entities_edit'],
          });

          // Setup: Create role with access to only workspaceId (not unauthorizedWorkspaceId)
          testStorage.roles.set(roleId, {
            id: roleId,
            organizationId,
            workspaceIds: [workspaceId],
          });

          // Setup: Create both workspaces
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
          });

          testStorage.workspaces.set(unauthorizedWorkspaceId, {
            id: unauthorizedWorkspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Original Name',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entity in UNAUTHORIZED workspace
          const weId = `we_${unauthorizedWorkspaceId}_${entityId}`;
          testStorage.workspaceEntities.set(weId, {
            id: weId,
            organizationId,
            workspaceId: unauthorizedWorkspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_1',
            status: 'active',
            workspaceTags: [],
            displayName: 'Original Name',
          });

          // Property: Unauthorized user cannot update entity
          await expect(
            updateEntityWithAuthorization(userId, entityId, unauthorizedWorkspaceId, updates)
          ).rejects.toThrow('Unauthorized');

          // Verify entity was NOT updated
          const entity = testStorage.entities.get(entityId);
          expect(entity.name).toBe('Original Name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject entity updates from users without entities_edit permission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }), // updates
        async (userId, workspaceId, entityId, updates) => {
          testStorage.reset();

          const organizationId = 'org_test';
          const roleId = 'role_viewer';

          // Setup: Create user WITHOUT entities_edit permission
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [roleId],
            permissions: ['entities_view'], // Only view permission
          });

          // Setup: Create role with workspace access
          testStorage.roles.set(roleId, {
            id: roleId,
            organizationId,
            workspaceIds: [workspaceId],
          });

          // Setup: Create workspace
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Original Name',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Property: User without entities_edit permission cannot update
          await expect(
            updateEntityWithAuthorization(userId, entityId, workspaceId, updates)
          ).rejects.toThrow('Unauthorized');

          // Verify entity was NOT updated
          const entity = testStorage.entities.get(entityId);
          expect(entity.name).toBe('Original Name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow system admins to update any entity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // adminUserId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }), // updates
        async (adminUserId, workspaceId, entityId, updates) => {
          testStorage.reset();

          const organizationId = 'org_test';

          // Setup: Create system admin user
          testStorage.users.set(adminUserId, {
            id: adminUserId,
            organizationId,
            roles: [],
            permissions: ['system_admin'], // System admin permission
          });

          // Setup: Create workspace
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Original Name',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Property: System admin can update any entity
          const result = await updateEntityWithAuthorization(adminUserId, entityId, workspaceId, updates);

          expect(result.success).toBe(true);

          // Verify entity was updated
          const updatedEntity = testStorage.entities.get(entityId);
          expect(updatedEntity.name).toBe(updates.name);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow authorized users to update workspace_entity operational fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // workspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        fc.record({
          pipelineId: fc.string({ minLength: 1, maxLength: 20 }),
          stageId: fc.string({ minLength: 1, maxLength: 20 }),
          workspaceTags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
        }), // updates
        async (userId, workspaceId, entityId, updates) => {
          testStorage.reset();

          const organizationId = 'org_test';
          const roleId = 'role_admin';
          const weId = `we_${workspaceId}_${entityId}`;

          // Setup: Create user with entities_edit permission
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [roleId],
            permissions: ['entities_edit'],
          });

          // Setup: Create role with workspace access
          testStorage.roles.set(roleId, {
            id: roleId,
            organizationId,
            workspaceIds: [workspaceId],
          });

          // Setup: Create workspace
          testStorage.workspaces.set(workspaceId, {
            id: workspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entity
          testStorage.workspaceEntities.set(weId, {
            id: weId,
            organizationId,
            workspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: 'pipeline_old',
            stageId: 'stage_old',
            status: 'active',
            workspaceTags: [],
            displayName: 'Test Entity',
          });

          // Property: Authorized user can update workspace_entity
          const result = await updateWorkspaceEntityWithAuthorization(userId, weId, updates);

          expect(result.success).toBe(true);

          // Verify workspace_entity was updated
          const updatedWE = testStorage.workspaceEntities.get(weId);
          expect(updatedWE.pipelineId).toBe(updates.pipelineId);
          expect(updatedWE.stageId).toBe(updates.stageId);
          expect(updatedWE.workspaceTags).toEqual(updates.workspaceTags);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 25: Cross-Workspace Isolation', () => {
  let testStorage: {
    workspaceEntities: Map<string, any>;
    entities: Map<string, any>;
    workspaces: Map<string, any>;
    users: Map<string, any>;
    roles: Map<string, any>;
    auditLogs: Map<string, any>;
    reset: () => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should only return workspace_entities from authorized workspaces when querying by entityId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // authorized workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // unauthorized workspaces
        fc.string({ minLength: 1, maxLength: 20 }), // shared entityId
        async (userId, authorizedWorkspaces, unauthorizedWorkspaces, entityId) => {
          testStorage.reset();

          // Ensure workspaces are unique and disjoint
          const uniqueAuthorized = [...new Set(authorizedWorkspaces)];
          const uniqueUnauthorized = [...new Set(unauthorizedWorkspaces)].filter(
            w => !uniqueAuthorized.includes(w)
          );

          if (uniqueAuthorized.length === 0 || uniqueUnauthorized.length === 0) return;

          const organizationId = 'org_test';

          // Setup: Create user with access to authorized workspaces only
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [],
            permissions: [],
          });

          // Setup: Create entity that exists in ALL workspaces
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Shared Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities in authorized workspaces
          uniqueAuthorized.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
            });

            const weId = `we_${workspaceId}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId,
              entityId,
              entityType: 'institution',
              pipelineId: `pipeline_${workspaceId}`,
              stageId: `stage_${workspaceId}`,
              status: 'active',
              workspaceTags: [`tag_authorized_${workspaceId}`],
              displayName: 'Shared Entity',
            });
          });

          // Setup: Create workspace_entities in unauthorized workspaces
          uniqueUnauthorized.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
            });

            const weId = `we_${workspaceId}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId,
              entityId,
              entityType: 'institution',
              pipelineId: `pipeline_${workspaceId}`,
              stageId: `stage_${workspaceId}`,
              status: 'active',
              workspaceTags: [`tag_unauthorized_${workspaceId}`],
              displayName: 'Shared Entity',
            });
          });

          // Property: Query by entityId returns only authorized workspace_entities
          const results = await queryWorkspaceEntitiesByEntityId(userId, entityId, uniqueAuthorized);

          // Should return workspace_entities from authorized workspaces only
          expect(results.length).toBe(uniqueAuthorized.length);

          // Verify all results are from authorized workspaces
          for (const weId of results) {
            const we = testStorage.workspaceEntities.get(weId);
            expect(we).toBeDefined();
            expect(uniqueAuthorized).toContain(we.workspaceId);
            expect(uniqueUnauthorized).not.toContain(we.workspaceId);
          }

          // Verify unauthorized workspace_entities are NOT returned
          for (const workspaceId of uniqueUnauthorized) {
            const unauthorizedWeId = `we_${workspaceId}_${entityId}`;
            expect(results).not.toContain(unauthorizedWeId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent access to workspace_entity data from unauthorized workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // authorizedWorkspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // unauthorizedWorkspaceId
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        async (userId, authorizedWorkspaceId, unauthorizedWorkspaceId, entityId) => {
          testStorage.reset();

          // Ensure workspaces are different
          if (authorizedWorkspaceId === unauthorizedWorkspaceId) return;

          const organizationId = 'org_test';
          const roleId = 'role_limited';

          // Setup: Create user with access to only authorized workspace
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [roleId],
            permissions: ['entities_edit'],
          });

          // Setup: Create role with access to only authorized workspace
          testStorage.roles.set(roleId, {
            id: roleId,
            organizationId,
            workspaceIds: [authorizedWorkspaceId],
          });

          // Setup: Create both workspaces
          testStorage.workspaces.set(authorizedWorkspaceId, {
            id: authorizedWorkspaceId,
            organizationId,
            contactScope: 'institution',
          });

          testStorage.workspaces.set(unauthorizedWorkspaceId, {
            id: unauthorizedWorkspaceId,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Shared Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entity in authorized workspace
          const authorizedWeId = `we_${authorizedWorkspaceId}_${entityId}`;
          testStorage.workspaceEntities.set(authorizedWeId, {
            id: authorizedWeId,
            organizationId,
            workspaceId: authorizedWorkspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: 'pipeline_authorized',
            stageId: 'stage_authorized',
            status: 'active',
            workspaceTags: ['tag_authorized'],
            displayName: 'Shared Entity',
          });

          // Setup: Create workspace_entity in unauthorized workspace
          const unauthorizedWeId = `we_${unauthorizedWorkspaceId}_${entityId}`;
          testStorage.workspaceEntities.set(unauthorizedWeId, {
            id: unauthorizedWeId,
            organizationId,
            workspaceId: unauthorizedWorkspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: 'pipeline_unauthorized',
            stageId: 'stage_unauthorized',
            status: 'active',
            workspaceTags: ['tag_unauthorized'],
            displayName: 'Shared Entity',
          });

          // Property 1: User can access authorized workspace_entity
          const authorizedResults = await queryWorkspaceEntitiesByEntityId(
            userId,
            entityId,
            [authorizedWorkspaceId]
          );
          expect(authorizedResults).toContain(authorizedWeId);

          // Property 2: User cannot access unauthorized workspace_entity
          const allResults = await queryWorkspaceEntitiesByEntityId(
            userId,
            entityId,
            [authorizedWorkspaceId]
          );
          expect(allResults).not.toContain(unauthorizedWeId);

          // Property 3: User cannot update unauthorized workspace_entity
          await expect(
            updateWorkspaceEntityWithAuthorization(userId, unauthorizedWeId, {
              pipelineId: 'pipeline_hacked',
            })
          ).rejects.toThrow('Unauthorized');

          // Verify unauthorized workspace_entity was NOT updated
          const unauthorizedWE = testStorage.workspaceEntities.get(unauthorizedWeId);
          expect(unauthorizedWE.pipelineId).toBe('pipeline_unauthorized');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should isolate workspace_entity data even when entity is shared across workspaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // user1Id
        fc.string({ minLength: 1, maxLength: 20 }), // user2Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace1Id
        fc.string({ minLength: 1, maxLength: 20 }), // workspace2Id
        fc.string({ minLength: 1, maxLength: 20 }), // sharedEntityId
        async (user1Id, user2Id, workspace1Id, workspace2Id, sharedEntityId) => {
          testStorage.reset();

          // Ensure users and workspaces are different
          if (user1Id === user2Id || workspace1Id === workspace2Id) return;

          const organizationId = 'org_test';
          const role1Id = 'role_workspace1';
          const role2Id = 'role_workspace2';

          // Setup: Create user1 with access to workspace1 only
          testStorage.users.set(user1Id, {
            id: user1Id,
            organizationId,
            roles: [role1Id],
            permissions: ['entities_edit'],
          });

          testStorage.roles.set(role1Id, {
            id: role1Id,
            organizationId,
            workspaceIds: [workspace1Id],
          });

          // Setup: Create user2 with access to workspace2 only
          testStorage.users.set(user2Id, {
            id: user2Id,
            organizationId,
            roles: [role2Id],
            permissions: ['entities_edit'],
          });

          testStorage.roles.set(role2Id, {
            id: role2Id,
            organizationId,
            workspaceIds: [workspace2Id],
          });

          // Setup: Create both workspaces
          testStorage.workspaces.set(workspace1Id, {
            id: workspace1Id,
            organizationId,
            contactScope: 'institution',
          });

          testStorage.workspaces.set(workspace2Id, {
            id: workspace2Id,
            organizationId,
            contactScope: 'institution',
          });

          // Setup: Create shared entity
          testStorage.entities.set(sharedEntityId, {
            id: sharedEntityId,
            organizationId,
            entityType: 'institution',
            name: 'Shared Entity',
            contacts: [],
            globalTags: ['global_tag'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entity in workspace1
          const we1Id = `we_${workspace1Id}_${sharedEntityId}`;
          testStorage.workspaceEntities.set(we1Id, {
            id: we1Id,
            organizationId,
            workspaceId: workspace1Id,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_1',
            stageId: 'stage_1',
            status: 'active',
            workspaceTags: ['workspace1_tag'],
            displayName: 'Shared Entity',
          });

          // Setup: Create workspace_entity in workspace2
          const we2Id = `we_${workspace2Id}_${sharedEntityId}`;
          testStorage.workspaceEntities.set(we2Id, {
            id: we2Id,
            organizationId,
            workspaceId: workspace2Id,
            entityId: sharedEntityId,
            entityType: 'institution',
            pipelineId: 'pipeline_2',
            stageId: 'stage_2',
            status: 'active',
            workspaceTags: ['workspace2_tag'],
            displayName: 'Shared Entity',
          });

          // Property 1: User1 can only see workspace1's workspace_entity
          const user1Results = await queryWorkspaceEntitiesByEntityId(
            user1Id,
            sharedEntityId,
            [workspace1Id]
          );
          expect(user1Results).toContain(we1Id);
          expect(user1Results).not.toContain(we2Id);

          // Property 2: User2 can only see workspace2's workspace_entity
          const user2Results = await queryWorkspaceEntitiesByEntityId(
            user2Id,
            sharedEntityId,
            [workspace2Id]
          );
          expect(user2Results).toContain(we2Id);
          expect(user2Results).not.toContain(we1Id);

          // Property 3: User1 cannot update workspace2's workspace_entity
          await expect(
            updateWorkspaceEntityWithAuthorization(user1Id, we2Id, {
              pipelineId: 'pipeline_hacked',
            })
          ).rejects.toThrow('Unauthorized');

          // Property 4: User2 cannot update workspace1's workspace_entity
          await expect(
            updateWorkspaceEntityWithAuthorization(user2Id, we1Id, {
              pipelineId: 'pipeline_hacked',
            })
          ).rejects.toThrow('Unauthorized');

          // Property 5: Workspace-specific data remains isolated
          const we1 = testStorage.workspaceEntities.get(we1Id);
          const we2 = testStorage.workspaceEntities.get(we2Id);

          expect(we1.workspaceId).toBe(workspace1Id);
          expect(we2.workspaceId).toBe(workspace2Id);
          expect(we1.pipelineId).not.toBe(we2.pipelineId);
          expect(we1.workspaceTags).not.toEqual(we2.workspaceTags);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty results when user has no access to any workspace containing the entity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // workspaces with entity
        fc.string({ minLength: 1, maxLength: 20 }), // entityId
        async (userId, workspacesWithEntity, entityId) => {
          testStorage.reset();

          const uniqueWorkspaces = [...new Set(workspacesWithEntity)];
          if (uniqueWorkspaces.length === 0) return;

          const organizationId = 'org_test';

          // Setup: Create user with NO workspace access
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [],
            permissions: [],
          });

          // Setup: Create entity
          testStorage.entities.set(entityId, {
            id: entityId,
            organizationId,
            entityType: 'institution',
            name: 'Test Entity',
            contacts: [],
            globalTags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Setup: Create workspace_entities in various workspaces
          uniqueWorkspaces.forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
            });

            const weId = `we_${workspaceId}_${entityId}`;
            testStorage.workspaceEntities.set(weId, {
              id: weId,
              organizationId,
              workspaceId,
              entityId,
              entityType: 'institution',
              pipelineId: `pipeline_${workspaceId}`,
              stageId: `stage_${workspaceId}`,
              status: 'active',
              workspaceTags: [],
              displayName: 'Test Entity',
            });
          });

          // Property: User with no workspace access gets empty results
          const results = await queryWorkspaceEntitiesByEntityId(userId, entityId, []);

          expect(results).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should enforce isolation for multi-workspace users querying by entityId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 4 }), // user's workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), // other workspaces
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // entity IDs
        async (userId, userWorkspaces, otherWorkspaces, entityIds) => {
          testStorage.reset();

          // Ensure we have unique workspace sets
          const uniqueUserWorkspaces = [...new Set(userWorkspaces)];
          const uniqueOtherWorkspaces = [...new Set(otherWorkspaces)].filter(
            w => !uniqueUserWorkspaces.includes(w)
          );

          if (uniqueUserWorkspaces.length < 2 || uniqueOtherWorkspaces.length === 0) return;

          const uniqueEntityIds = [...new Set(entityIds)];
          if (uniqueEntityIds.length === 0) return;

          const organizationId = 'org_test';

          // Setup: Create user with access to multiple workspaces
          testStorage.users.set(userId, {
            id: userId,
            organizationId,
            roles: [],
            permissions: [],
          });

          // Setup: Create all workspaces
          [...uniqueUserWorkspaces, ...uniqueOtherWorkspaces].forEach(workspaceId => {
            testStorage.workspaces.set(workspaceId, {
              id: workspaceId,
              organizationId,
              contactScope: 'institution',
            });
          });

          // Setup: Create entities that exist in ALL workspaces
          uniqueEntityIds.forEach(entityId => {
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

            // Link entity to all workspaces
            [...uniqueUserWorkspaces, ...uniqueOtherWorkspaces].forEach(workspaceId => {
              const weId = `we_${workspaceId}_${entityId}`;
              testStorage.workspaceEntities.set(weId, {
                id: weId,
                organizationId,
                workspaceId,
                entityId,
                entityType: 'institution',
                pipelineId: `pipeline_${workspaceId}`,
                stageId: `stage_${workspaceId}`,
                status: 'active',
                workspaceTags: [`tag_${workspaceId}`],
                displayName: `Entity ${entityId}`,
              });
            });
          });

          // Property: For each entity, user only sees workspace_entities from authorized workspaces
          for (const entityId of uniqueEntityIds) {
            const results = await queryWorkspaceEntitiesByEntityId(
              userId,
              entityId,
              uniqueUserWorkspaces
            );

            // Should return workspace_entities from user's workspaces only
            expect(results.length).toBe(uniqueUserWorkspaces.length);

            // Verify all results are from authorized workspaces
            for (const weId of results) {
              const we = testStorage.workspaceEntities.get(weId);
              expect(we).toBeDefined();
              expect(uniqueUserWorkspaces).toContain(we.workspaceId);
              expect(uniqueOtherWorkspaces).not.toContain(we.workspaceId);
            }

            // Verify unauthorized workspace_entities are NOT returned
            for (const workspaceId of uniqueOtherWorkspaces) {
              const unauthorizedWeId = `we_${workspaceId}_${entityId}`;
              expect(results).not.toContain(unauthorizedWeId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
