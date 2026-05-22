/**
 * Workspace Test Factories
 * 
 * Factory functions for creating test workspaces and organizations
 */

import type { Workspace, Organization, UserProfile } from '@/lib/types';

let workspaceCounter = 0;
let organizationCounter = 0;
let userCounter = 0;

/**
 * Reset counters (call in beforeEach)
 */
export function resetWorkspaceCounters() {
  workspaceCounter = 0;
  organizationCounter = 0;
  userCounter = 0;
}

/**
 * Create a test organization
 */
export function createTestOrganization(overrides: Partial<Organization> = {}): Organization {
  const id = overrides.id || `org-${++organizationCounter}`;
  
  return {
    id,
    name: `Test Organization ${organizationCounter}`,
    slug: `test-org-${organizationCounter}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test workspace
 */
export function createTestWorkspace(
  organizationId: string,
  overrides: Partial<Workspace> = {}
): Workspace {
  const id = overrides.id || `workspace-${++workspaceCounter}`;
  
  return {
    id,
    name: `Test Workspace ${workspaceCounter}`,
    organizationId,
    industry: 'SchoolEnrollment',
    industryScopeLocked: false,
    status: 'active',
    statuses: [],
    description: `Test workspace ${workspaceCounter} description`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple test workspaces
 */
export function createTestWorkspaces(
  organizationId: string,
  count: number,
  overrides: Partial<Workspace> = {}
): Workspace[] {
  return Array.from({ length: count }, () => 
    createTestWorkspace(organizationId, overrides)
  );
}

/**
 * Create a test user profile
 */
export function createTestUser(overrides: Partial<UserProfile> = {}): UserProfile {
  const id = overrides.id || `user-${++userCounter}`;
  
  return {
    id,
    email: `user${userCounter}@test.com`,
    name: `Test User ${userCounter}`,
    phone: `+1234567${String(userCounter).padStart(4, '0')}`,
    organizationId: 'test-org-id',
    workspaceIds: ['test-workspace-id'],
    isAuthorized: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test user with workspace-scoped roles
 */
export function createTestUserWithWorkspaceRoles(
  workspaceId: string,
  roles: string[],
  overrides: Partial<UserProfile> = {}
): UserProfile {
  const user = createTestUser(overrides);
  
  return {
    ...user,
    workspaceIds: [workspaceId, ...(overrides.workspaceIds || [])],
    workspaceRoles: {
      [workspaceId]: roles,
    },
    workspacePermissions: {
      [workspaceId]: [],
    },
    workspacePermissionsSchemas: {
      [workspaceId]: {
        operations: {
          enabled: true,
          features: {
            entities: { view: true, create: false, edit: false, delete: false },
            pipeline: { view: true, create: false, edit: false, delete: false },
            tasks: { view: true, create: false, edit: false, delete: false },
          },
        },
        finance: {
          enabled: false,
          features: {},
        },
        studios: {
          enabled: true,
          features: {
            messaging: { view: true, create: false, edit: false, delete: false },
            tags: { view: true, create: false, edit: false, delete: false },
          },
        },
        management: {
          enabled: false,
          features: {},
        },
      },
    },
  };
}

/**
 * Create a test admin user
 */
export function createTestAdminUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return createTestUser({
    isAuthorized: true,
    ...overrides,
  });
}

/**
 * Create a complete organization with workspaces and users
 */
export function createTestOrganizationSetup(config: {
  workspaceCount?: number;
  userCount?: number;
  orgOverrides?: Partial<Organization>;
  workspaceOverrides?: Partial<Workspace>;
  userOverrides?: Partial<UserProfile>;
} = {}): {
  organization: Organization;
  workspaces: Workspace[];
  users: UserProfile[];
} {
  const {
    workspaceCount = 1,
    userCount = 1,
    orgOverrides = {},
    workspaceOverrides = {},
    userOverrides = {},
  } = config;
  
  const organization = createTestOrganization(orgOverrides);
  const workspaces = createTestWorkspaces(organization.id, workspaceCount, {
    ...workspaceOverrides,
    organizationId: organization.id,
  });
  
  const users = Array.from({ length: userCount }, () =>
    createTestUser({
      ...userOverrides,
      organizationId: organization.id,
      workspaceIds: workspaces.map(w => w.id),
    })
  );
  
  return { organization, workspaces, users };
}
