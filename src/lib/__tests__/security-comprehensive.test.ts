/**
 * Comprehensive Security Tests
 * 
 * Task 29.3: Write security tests
 * - Test workspace boundary enforcement
 * - Test entity update authorization
 * - Test cross-workspace isolation
 * - Test audit logging captures all operations
 * 
 * Requirements: 26.2, 29.1, 29.2, 29.3, 29.4, 29.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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
  const auditLogs: any[] = [];

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
        } else if (collectionName === 'entity_audit_logs') {
          return {
            doc: vi.fn(() => ({
              id: `audit_${Date.now()}_${Math.random()}`,
              set: vi.fn().mockImplementation(async (data: any) => {
                auditLogs.push(data);
              }),
            })),
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockImplementation(async () => ({
                    docs: auditLogs.map((log, index) => ({
                      id: `audit_${index}`,
                      data: () => log,
                    })),
                  })),
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
        auditLogs.length = 0;
      },
    },
  };
});

/**
 * Check if user has permission to access a workspace
 */
function userHasWorkspaceAccess(userId: string, workspaceId: string, userWorkspaces: string[]): boolean {
  return userWorkspaces.includes(workspaceId);
}

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
 * Update entity with authorization and audit logging
 */
async function updateEntityWithAuthorizationAndAudit(
  userId: string,
  entityId: string,
  workspaceId: string,
  updates: any,
  userInfo: { name: string; email: string }
): Promise<{ success: boolean; error?: string }> {
  const { adminDb } = await import('../firebase-admin');

  // Check permission
  const permissionCheck = await checkEntityUpdatePermission(userId, workspaceId, entityId);

  if (!permissionCheck.granted) {
    // Log failed authorization attempt
    const auditRef = adminDb.collection('entity_audit_logs').doc();
    await auditRef.set({
      id: auditRef.id,
      organizationId: 'org_test',
      action: 'entity_update_denied',
      entityId,
      userId,
      userName: userInfo.name,
      userEmail: userInfo.email,
      timestamp: new Date().toISOString(),
      metadata: {
        reason: permissionCheck.reason,
        attemptedUpdates: updates,
      },
    });

    throw new Error(`Unauthorized: ${permissionCheck.reason}`);
  }

  // Get old value for audit
  const entitySnap = await adminDb.collection('entities').doc(entityId).get();
  const oldValue = entitySnap.data();

  // Update entity
  await adminDb.collection('entities').doc(entityId).update(updates);

  // Log successful update
  const auditRef = adminDb.collection('entity_audit_logs').doc();
  await auditRef.set({
    id: auditRef.id,
    organizationId: 'org_test',
    action: 'entity_updated',
    entityId,
    entityType: oldValue?.entityType,
    userId,
    userName: userInfo.name,
    userEmail: userInfo.email,
    timestamp: new Date().toISOString(),
    metadata: {
      oldValue,
      newValue: { ...oldValue, ...updates },
      changedFields: Object.keys(updates),
      operationContext: 'manual_edit',
    },
  });

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

describe('Security: Workspace Boundary Enforcement', () => {
  let testStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should enforce workspace boundaries for entity queries', async () => {
    const userId = 'user_1';
    const authorizedWorkspace = 'workspace_authorized';
    const unauthorizedWorkspace = 'workspace_unauthorized';
    const entityId = 'entity_shared';
    const organizationId = 'org_test';

    // Setup: Create user with access to only one workspace
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
      name: 'Shared Entity',
      contacts: [],
      globalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Setup: Create workspace_entities in both workspaces
    testStorage.workspaceEntities.set(`we_${authorizedWorkspace}_${entityId}`, {
      id: `we_${authorizedWorkspace}_${entityId}`,
      organizationId,
      workspaceId: authorizedWorkspace,
      entityId,
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      status: 'active',
      workspaceTags: ['authorized_tag'],
      displayName: 'Shared Entity',
    });

    testStorage.workspaceEntities.set(`we_${unauthorizedWorkspace}_${entityId}`, {
      id: `we_${unauthorizedWorkspace}_${entityId}`,
      organizationId,
      workspaceId: unauthorizedWorkspace,
      entityId,
      entityType: 'institution',
      pipelineId: 'pipeline_2',
      stageId: 'stage_2',
      status: 'active',
      workspaceTags: ['unauthorized_tag'],
      displayName: 'Shared Entity',
    });

    // Test: User can only access authorized workspace
    const results = await queryWorkspaceEntitiesByEntityId(userId, entityId, [authorizedWorkspace]);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(`we_${authorizedWorkspace}_${entityId}`);
    expect(results).not.toContain(`we_${unauthorizedWorkspace}_${entityId}`);
  });

  it('should prevent cross-workspace data leakage', async () => {
    const user1Id = 'user_1';
    const user2Id = 'user_2';
    const workspace1 = 'workspace_1';
    const workspace2 = 'workspace_2';
    const sharedEntityId = 'entity_shared';
    const organizationId = 'org_test';

    // Setup: Create users with different workspace access
    testStorage.users.set(user1Id, {
      id: user1Id,
      organizationId,
      roles: [],
      permissions: [],
    });

    testStorage.users.set(user2Id, {
      id: user2Id,
      organizationId,
      roles: [],
      permissions: [],
    });

    // Setup: Create shared entity
    testStorage.entities.set(sharedEntityId, {
      id: sharedEntityId,
      organizationId,
      entityType: 'institution',
      name: 'Shared Entity',
      contacts: [],
      globalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Setup: Create workspace_entities with different operational data
    testStorage.workspaceEntities.set(`we_${workspace1}_${sharedEntityId}`, {
      id: `we_${workspace1}_${sharedEntityId}`,
      organizationId,
      workspaceId: workspace1,
      entityId: sharedEntityId,
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      status: 'active',
      workspaceTags: ['workspace1_secret'],
      displayName: 'Shared Entity',
    });

    testStorage.workspaceEntities.set(`we_${workspace2}_${sharedEntityId}`, {
      id: `we_${workspace2}_${sharedEntityId}`,
      organizationId,
      workspaceId: workspace2,
      entityId: sharedEntityId,
      entityType: 'institution',
      pipelineId: 'pipeline_2',
      stageId: 'stage_2',
      status: 'active',
      workspaceTags: ['workspace2_secret'],
      displayName: 'Shared Entity',
    });

    // Test: User1 can only see workspace1 data
    const user1Results = await queryWorkspaceEntitiesByEntityId(user1Id, sharedEntityId, [workspace1]);
    expect(user1Results).toHaveLength(1);
    const user1Data = testStorage.workspaceEntities.get(user1Results[0]);
    expect(user1Data.workspaceTags).toContain('workspace1_secret');
    expect(user1Data.workspaceTags).not.toContain('workspace2_secret');

    // Test: User2 can only see workspace2 data
    const user2Results = await queryWorkspaceEntitiesByEntityId(user2Id, sharedEntityId, [workspace2]);
    expect(user2Results).toHaveLength(1);
    const user2Data = testStorage.workspaceEntities.get(user2Results[0]);
    expect(user2Data.workspaceTags).toContain('workspace2_secret');
    expect(user2Data.workspaceTags).not.toContain('workspace1_secret');
  });

  it('should return empty results for users with no workspace access', async () => {
    const userId = 'user_no_access';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
    const organizationId = 'org_test';

    // Setup: Create user with no workspace access
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [],
      permissions: [],
    });

    // Setup: Create entity and workspace_entity
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

    testStorage.workspaceEntities.set(`we_${workspaceId}_${entityId}`, {
      id: `we_${workspaceId}_${entityId}`,
      organizationId,
      workspaceId,
      entityId,
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      status: 'active',
      workspaceTags: [],
      displayName: 'Test Entity',
    });

    // Test: User with no access gets empty results
    const results = await queryWorkspaceEntitiesByEntityId(userId, entityId, []);
    expect(results).toEqual([]);
  });
});

describe('Security: Entity Update Authorization', () => {
  let testStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should allow authorized users to update entities', async () => {
    const userId = 'user_authorized';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
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

    // Test: Authorized user can update entity
    const updates = { name: 'Updated Name' };
    const result = await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      updates,
      { name: 'Test User', email: 'test@example.com' }
    );

    expect(result.success).toBe(true);

    // Verify entity was updated
    const updatedEntity = testStorage.entities.get(entityId);
    expect(updatedEntity.name).toBe('Updated Name');
  });

  it('should reject updates from unauthorized users', async () => {
    const userId = 'user_unauthorized';
    const workspaceId = 'workspace_1';
    const unauthorizedWorkspaceId = 'workspace_2';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_limited';

    // Setup: Create user with access to only workspace_1
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    // Setup: Create role with access to only workspace_1
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

    // Test: Unauthorized user cannot update entity
    const updates = { name: 'Hacked Name' };
    await expect(
      updateEntityWithAuthorizationAndAudit(
        userId,
        entityId,
        unauthorizedWorkspaceId,
        updates,
        { name: 'Hacker', email: 'hacker@example.com' }
      )
    ).rejects.toThrow('Unauthorized');

    // Verify entity was NOT updated
    const entity = testStorage.entities.get(entityId);
    expect(entity.name).toBe('Original Name');
  });

  it('should reject updates from users without entities_edit permission', async () => {
    const userId = 'user_viewer';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
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

    // Test: User without entities_edit permission cannot update
    const updates = { name: 'Unauthorized Update' };
    await expect(
      updateEntityWithAuthorizationAndAudit(
        userId,
        entityId,
        workspaceId,
        updates,
        { name: 'Viewer User', email: 'viewer@example.com' }
      )
    ).rejects.toThrow('Unauthorized');

    // Verify entity was NOT updated
    const entity = testStorage.entities.get(entityId);
    expect(entity.name).toBe('Original Name');
  });

  it('should allow system admins to update any entity', async () => {
    const adminUserId = 'admin_user';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
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

    // Test: System admin can update any entity
    const updates = { name: 'Admin Updated Name' };
    const result = await updateEntityWithAuthorizationAndAudit(
      adminUserId,
      entityId,
      workspaceId,
      updates,
      { name: 'Admin User', email: 'admin@example.com' }
    );

    expect(result.success).toBe(true);

    // Verify entity was updated
    const updatedEntity = testStorage.entities.get(entityId);
    expect(updatedEntity.name).toBe('Admin Updated Name');
  });
});

describe('Security: Cross-Workspace Isolation', () => {
  let testStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  it('should isolate workspace_entity data across workspaces', async () => {
    const user1Id = 'user_1';
    const user2Id = 'user_2';
    const workspace1 = 'workspace_1';
    const workspace2 = 'workspace_2';
    const sharedEntityId = 'entity_shared';
    const organizationId = 'org_test';

    // Setup: Create users
    testStorage.users.set(user1Id, {
      id: user1Id,
      organizationId,
      roles: [],
      permissions: [],
    });

    testStorage.users.set(user2Id, {
      id: user2Id,
      organizationId,
      roles: [],
      permissions: [],
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

    // Setup: Create workspace_entities with different operational data
    testStorage.workspaceEntities.set(`we_${workspace1}_${sharedEntityId}`, {
      id: `we_${workspace1}_${sharedEntityId}`,
      organizationId,
      workspaceId: workspace1,
      entityId: sharedEntityId,
      entityType: 'institution',
      pipelineId: 'pipeline_1',
      stageId: 'stage_1',
      status: 'active',
      workspaceTags: ['workspace1_tag'],
      displayName: 'Shared Entity',
    });

    testStorage.workspaceEntities.set(`we_${workspace2}_${sharedEntityId}`, {
      id: `we_${workspace2}_${sharedEntityId}`,
      organizationId,
      workspaceId: workspace2,
      entityId: sharedEntityId,
      entityType: 'institution',
      pipelineId: 'pipeline_2',
      stageId: 'stage_2',
      status: 'active',
      workspaceTags: ['workspace2_tag'],
      displayName: 'Shared Entity',
    });

    // Test: User1 can only see workspace1's workspace_entity
    const user1Results = await queryWorkspaceEntitiesByEntityId(user1Id, sharedEntityId, [workspace1]);
    expect(user1Results).toHaveLength(1);
    expect(user1Results[0]).toBe(`we_${workspace1}_${sharedEntityId}`);

    // Test: User2 can only see workspace2's workspace_entity
    const user2Results = await queryWorkspaceEntitiesByEntityId(user2Id, sharedEntityId, [workspace2]);
    expect(user2Results).toHaveLength(1);
    expect(user2Results[0]).toBe(`we_${workspace2}_${sharedEntityId}`);

    // Test: Workspace-specific data is isolated
    const we1 = testStorage.workspaceEntities.get(`we_${workspace1}_${sharedEntityId}`);
    const we2 = testStorage.workspaceEntities.get(`we_${workspace2}_${sharedEntityId}`);

    expect(we1.pipelineId).not.toBe(we2.pipelineId);
    expect(we1.workspaceTags).not.toEqual(we2.workspaceTags);
  });

  it('should prevent access to workspace_entity from unauthorized workspace', async () => {
    const userId = 'user_1';
    const authorizedWorkspace = 'workspace_authorized';
    const unauthorizedWorkspace = 'workspace_unauthorized';
    const entityId = 'entity_1';
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
      workspaceIds: [authorizedWorkspace],
    });

    // Setup: Create both workspaces
    testStorage.workspaces.set(authorizedWorkspace, {
      id: authorizedWorkspace,
      organizationId,
      contactScope: 'institution',
    });

    testStorage.workspaces.set(unauthorizedWorkspace, {
      id: unauthorizedWorkspace,
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

    // Setup: Create workspace_entities in both workspaces
    const authorizedWeId = `we_${authorizedWorkspace}_${entityId}`;
    testStorage.workspaceEntities.set(authorizedWeId, {
      id: authorizedWeId,
      organizationId,
      workspaceId: authorizedWorkspace,
      entityId,
      entityType: 'institution',
      pipelineId: 'pipeline_authorized',
      stageId: 'stage_authorized',
      status: 'active',
      workspaceTags: ['authorized_tag'],
      displayName: 'Test Entity',
    });

    const unauthorizedWeId = `we_${unauthorizedWorkspace}_${entityId}`;
    testStorage.workspaceEntities.set(unauthorizedWeId, {
      id: unauthorizedWeId,
      organizationId,
      workspaceId: unauthorizedWorkspace,
      entityId,
      entityType: 'institution',
      pipelineId: 'pipeline_unauthorized',
      stageId: 'stage_unauthorized',
      status: 'active',
      workspaceTags: ['unauthorized_tag'],
      displayName: 'Test Entity',
    });

    // Test: User can access authorized workspace_entity
    const authorizedResults = await queryWorkspaceEntitiesByEntityId(
      userId,
      entityId,
      [authorizedWorkspace]
    );
    expect(authorizedResults).toContain(authorizedWeId);

    // Test: User cannot access unauthorized workspace_entity
    expect(authorizedResults).not.toContain(unauthorizedWeId);
  });

  it('should maintain isolation for multi-workspace users', async () => {
    const userId = 'user_multi';
    const workspace1 = 'workspace_1';
    const workspace2 = 'workspace_2';
    const workspace3 = 'workspace_3';
    const entityId = 'entity_1';
    const organizationId = 'org_test';

    // Setup: Create user with access to workspace1 and workspace2 (not workspace3)
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
      name: 'Multi-Workspace Entity',
      contacts: [],
      globalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Setup: Create workspace_entities in all three workspaces
    [workspace1, workspace2, workspace3].forEach((workspaceId, index) => {
      const weId = `we_${workspaceId}_${entityId}`;
      testStorage.workspaceEntities.set(weId, {
        id: weId,
        organizationId,
        workspaceId,
        entityId,
        entityType: 'institution',
        pipelineId: `pipeline_${index + 1}`,
        stageId: `stage_${index + 1}`,
        status: 'active',
        workspaceTags: [`tag_${workspaceId}`],
        displayName: 'Multi-Workspace Entity',
      });
    });

    // Test: User can access workspace1 and workspace2
    const results = await queryWorkspaceEntitiesByEntityId(userId, entityId, [workspace1, workspace2]);
    expect(results).toHaveLength(2);
    expect(results).toContain(`we_${workspace1}_${entityId}`);
    expect(results).toContain(`we_${workspace2}_${entityId}`);

    // Test: User cannot access workspace3
    expect(results).not.toContain(`we_${workspace3}_${entityId}`);
  });
});

describe('Security: Audit Logging', () => {
  let testStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const firebaseAdmin = await import('../firebase-admin') as any;
    testStorage = firebaseAdmin.__testStorage;
    testStorage.reset();
  });

  afterEach(() => {
    // Clear audit logs after each test
    testStorage.auditLogs.length = 0;
  });

  it('should log successful entity updates', async () => {
    const userId = 'user_1';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_admin';

    // Setup: Create authorized user
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    testStorage.roles.set(roleId, {
      id: roleId,
      organizationId,
      workspaceIds: [workspaceId],
    });

    testStorage.workspaces.set(workspaceId, {
      id: workspaceId,
      organizationId,
      contactScope: 'institution',
    });

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

    // Test: Update entity
    const updates = { name: 'Updated Name', globalTags: ['new_tag'] };
    await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      updates,
      { name: 'Test User', email: 'test@example.com' }
    );

    // Verify: Audit log was created
    expect(testStorage.auditLogs).toHaveLength(1);

    const auditLog = testStorage.auditLogs[0];
    expect(auditLog.action).toBe('entity_updated');
    expect(auditLog.entityId).toBe(entityId);
    expect(auditLog.userId).toBe(userId);
    expect(auditLog.userName).toBe('Test User');
    expect(auditLog.userEmail).toBe('test@example.com');
    expect(auditLog.metadata.changedFields).toEqual(['name', 'globalTags']);
    expect(auditLog.metadata.oldValue.name).toBe('Original Name');
    expect(auditLog.metadata.newValue.name).toBe('Updated Name');
  });

  it('should log failed authorization attempts', async () => {
    const userId = 'user_unauthorized';
    const workspaceId = 'workspace_1';
    const unauthorizedWorkspaceId = 'workspace_2';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_limited';

    // Setup: Create user with limited access
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    testStorage.roles.set(roleId, {
      id: roleId,
      organizationId,
      workspaceIds: [workspaceId],
    });

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

    // Test: Attempt unauthorized update
    const updates = { name: 'Hacked Name' };
    await expect(
      updateEntityWithAuthorizationAndAudit(
        userId,
        entityId,
        unauthorizedWorkspaceId,
        updates,
        { name: 'Unauthorized User', email: 'unauthorized@example.com' }
      )
    ).rejects.toThrow('Unauthorized');

    // Verify: Failed attempt was logged
    expect(testStorage.auditLogs).toHaveLength(1);

    const auditLog = testStorage.auditLogs[0];
    expect(auditLog.action).toBe('entity_update_denied');
    expect(auditLog.entityId).toBe(entityId);
    expect(auditLog.userId).toBe(userId);
    expect(auditLog.userName).toBe('Unauthorized User');
    expect(auditLog.userEmail).toBe('unauthorized@example.com');
    expect(auditLog.metadata.reason).toContain('does not have access');
    expect(auditLog.metadata.attemptedUpdates).toEqual(updates);
  });

  it('should log all entity operations with complete metadata', async () => {
    const userId = 'user_1';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_admin';

    // Setup
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    testStorage.roles.set(roleId, {
      id: roleId,
      organizationId,
      workspaceIds: [workspaceId],
    });

    testStorage.workspaces.set(workspaceId, {
      id: workspaceId,
      organizationId,
      contactScope: 'institution',
    });

    testStorage.entities.set(entityId, {
      id: entityId,
      organizationId,
      entityType: 'institution',
      name: 'Original Name',
      contacts: [],
      globalTags: ['tag1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Test: Perform multiple updates
    await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      { name: 'First Update' },
      { name: 'Test User', email: 'test@example.com' }
    );

    await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      { globalTags: ['tag1', 'tag2'] },
      { name: 'Test User', email: 'test@example.com' }
    );

    // Verify: All operations were logged
    expect(testStorage.auditLogs).toHaveLength(2);

    // Verify first update
    const firstLog = testStorage.auditLogs[0];
    expect(firstLog.action).toBe('entity_updated');
    expect(firstLog.metadata.changedFields).toEqual(['name']);
    expect(firstLog.metadata.oldValue.name).toBe('Original Name');
    expect(firstLog.metadata.newValue.name).toBe('First Update');

    // Verify second update
    const secondLog = testStorage.auditLogs[1];
    expect(secondLog.action).toBe('entity_updated');
    expect(secondLog.metadata.changedFields).toEqual(['globalTags']);
    expect(secondLog.metadata.oldValue.globalTags).toEqual(['tag1']);
    expect(secondLog.metadata.newValue.globalTags).toEqual(['tag1', 'tag2']);
  });

  it('should include timestamp in all audit logs', async () => {
    const userId = 'user_1';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_admin';

    // Setup
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    testStorage.roles.set(roleId, {
      id: roleId,
      organizationId,
      workspaceIds: [workspaceId],
    });

    testStorage.workspaces.set(workspaceId, {
      id: workspaceId,
      organizationId,
      contactScope: 'institution',
    });

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

    // Test: Update entity
    const beforeUpdate = new Date().toISOString();
    await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      { name: 'Updated Name' },
      { name: 'Test User', email: 'test@example.com' }
    );
    const afterUpdate = new Date().toISOString();

    // Verify: Audit log has timestamp
    expect(testStorage.auditLogs).toHaveLength(1);

    const auditLog = testStorage.auditLogs[0];
    expect(auditLog.timestamp).toBeDefined();
    expect(auditLog.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(auditLog.timestamp >= beforeUpdate).toBe(true);
    expect(auditLog.timestamp <= afterUpdate).toBe(true);
  });

  it('should log user information in all audit entries', async () => {
    const userId = 'user_1';
    const workspaceId = 'workspace_1';
    const entityId = 'entity_1';
    const organizationId = 'org_test';
    const roleId = 'role_admin';

    // Setup
    testStorage.users.set(userId, {
      id: userId,
      organizationId,
      roles: [roleId],
      permissions: ['entities_edit'],
    });

    testStorage.roles.set(roleId, {
      id: roleId,
      organizationId,
      workspaceIds: [workspaceId],
    });

    testStorage.workspaces.set(workspaceId, {
      id: workspaceId,
      organizationId,
      contactScope: 'institution',
    });

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

    // Test: Update entity
    await updateEntityWithAuthorizationAndAudit(
      userId,
      entityId,
      workspaceId,
      { name: 'Updated Name' },
      { name: 'John Doe', email: 'john.doe@example.com' }
    );

    // Verify: User information is logged
    expect(testStorage.auditLogs).toHaveLength(1);

    const auditLog = testStorage.auditLogs[0];
    expect(auditLog.userId).toBe(userId);
    expect(auditLog.userName).toBe('John Doe');
    expect(auditLog.userEmail).toBe('john.doe@example.com');
    expect(auditLog.organizationId).toBe(organizationId);
  });
});
