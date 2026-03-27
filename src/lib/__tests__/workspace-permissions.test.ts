import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkWorkspaceAccess,
  checkWorkspaceEntityAccess,
  checkWorkspacePermission,
  checkWorkspaceCapability,
  checkFullWorkspacePermission,
  getUserWorkspaceIds,
} from '../workspace-permissions';
import { adminDb } from '../firebase-admin';
import type { UserProfile, Role, Workspace, WorkspaceEntity } from '../types';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('workspace-permissions', () => {
  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-456';
  const mockOrganizationId = 'org-789';
  const mockRoleId = 'role-abc';
  const mockWorkspaceEntityId = 'we-xyz';

  const mockUser: UserProfile = {
    id: mockUserId,
    organizationId: mockOrganizationId,
    workspaceIds: [mockWorkspaceId],
    name: 'Test User',
    email: 'test@example.com',
    phone: '1234567890',
    isAuthorized: true,
    roles: [mockRoleId],
    permissions: ['schools_view', 'schools_edit'],
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockRole: Role = {
    id: mockRoleId,
    organizationId: mockOrganizationId,
    name: 'Test Role',
    description: 'Test role description',
    permissions: ['schools_view', 'schools_edit'],
    workspaceIds: [mockWorkspaceId],
    color: '#000000',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockWorkspace: Workspace = {
    id: mockWorkspaceId,
    organizationId: mockOrganizationId,
    name: 'Test Workspace',
    status: 'active',
    statuses: [],
    contactScope: 'institution',
    capabilities: {
      billing: true,
      admissions: false,
      children: false,
      contracts: true,
      messaging: true,
      automations: true,
      tasks: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockWorkspaceEntity: WorkspaceEntity = {
    id: mockWorkspaceEntityId,
    organizationId: mockOrganizationId,
    workspaceId: mockWorkspaceId,
    entityId: 'entity-123',
    entityType: 'institution',
    pipelineId: 'pipeline-123',
    stageId: 'stage-123',
    status: 'active',
    workspaceTags: [],
    addedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    displayName: 'Test Entity',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkWorkspaceAccess', () => {
    it('should grant access when user has role with workspace access', async () => {
      // Mock user fetch
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      // Mock workspace fetch
      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      // Mock roles fetch
      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId);

      expect(result.granted).toBe(true);
    });

    it('should deny access when user not found', async () => {
      const userDoc = {
        exists: false,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User not found');
      expect(result.level).toBe('organization');
    });

    it('should deny access when user belongs to different organization', async () => {
      const userDoc = {
        exists: true,
        data: () => ({ ...mockUser, organizationId: 'different-org' }),
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User does not belong to workspace organization');
      expect(result.level).toBe('organization');
    });

    it('should deny access when user has no role granting workspace access', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => ({ ...mockRole, workspaceIds: ['different-workspace'] }),
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User does not have a role that grants access to this workspace');
      expect(result.level).toBe('workspace');
    });

    it('should grant access to system admins regardless of role workspace access', async () => {
      const adminUser = {
        ...mockUser,
        permissions: ['system_admin'],
      };

      const userDoc = {
        exists: true,
        data: () => adminUser,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId);

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('System admin bypass');
    });
  });

  describe('checkWorkspaceEntityAccess', () => {
    it('should grant access when user has workspace access', async () => {
      const weDoc = {
        exists: true,
        data: () => mockWorkspaceEntity,
      };

      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            doc: () => ({
              get: async () => weDoc,
            }),
          };
        }
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkWorkspaceEntityAccess(mockUserId, mockWorkspaceEntityId);

      expect(result.granted).toBe(true);
    });

    it('should deny access when workspace_entities record not found', async () => {
      const weDoc = {
        exists: false,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspace_entities') {
          return {
            doc: () => ({
              get: async () => weDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceEntityAccess(mockUserId, mockWorkspaceEntityId);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Workspace entity record not found');
      expect(result.level).toBe('workspace-entity');
    });
  });

  describe('checkWorkspacePermission', () => {
    it('should grant access when user has workspace access and permission', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkWorkspacePermission(mockUserId, mockWorkspaceId, 'schools_edit');

      expect(result.granted).toBe(true);
    });

    it('should deny access when user lacks required permission', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkWorkspacePermission(mockUserId, mockWorkspaceId, 'finance_manage');

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('User does not have required permission');
      expect(result.level).toBe('feature');
    });
  });

  describe('checkWorkspaceCapability', () => {
    it('should grant access when workspace has capability enabled', async () => {
      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceCapability(mockWorkspaceId, 'billing');

      expect(result.granted).toBe(true);
    });

    it('should deny access when workspace capability is disabled', async () => {
      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
      });

      const result = await checkWorkspaceCapability(mockWorkspaceId, 'admissions');

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('does not have admissions capability enabled');
      expect(result.level).toBe('feature');
    });
  });

  describe('checkFullWorkspacePermission', () => {
    it('should grant access when all checks pass', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkFullWorkspacePermission(
        mockUserId,
        mockWorkspaceId,
        'schools_edit',
        'billing'
      );

      expect(result.granted).toBe(true);
    });

    it('should deny access when capability check fails', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const workspaceDoc = {
        exists: true,
        data: () => mockWorkspace,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            doc: () => ({
              get: async () => workspaceDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await checkFullWorkspacePermission(
        mockUserId,
        mockWorkspaceId,
        'schools_edit',
        'admissions'
      );

      expect(result.granted).toBe(false);
      expect(result.level).toBe('feature');
    });
  });

  describe('getUserWorkspaceIds', () => {
    it('should return all workspace IDs user has access to', async () => {
      const userDoc = {
        exists: true,
        data: () => mockUser,
      };

      const rolesSnapshot = {
        docs: [
          {
            id: mockRoleId,
            data: () => mockRole,
          },
          {
            id: 'role-2',
            data: () => ({
              ...mockRole,
              id: 'role-2',
              workspaceIds: ['workspace-2', 'workspace-3'],
            }),
          },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'roles') {
          return {
            where: () => ({
              get: async () => rolesSnapshot,
            }),
          };
        }
      });

      const result = await getUserWorkspaceIds(mockUserId);

      expect(result).toContain(mockWorkspaceId);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return all workspaces for system admin', async () => {
      const adminUser = {
        ...mockUser,
        permissions: ['system_admin'],
      };

      const userDoc = {
        exists: true,
        data: () => adminUser,
      };

      const workspacesSnapshot = {
        docs: [
          { id: 'workspace-1' },
          { id: 'workspace-2' },
          { id: 'workspace-3' },
        ],
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
        if (collectionName === 'workspaces') {
          return {
            where: () => ({
              get: async () => workspacesSnapshot,
            }),
          };
        }
      });

      const result = await getUserWorkspaceIds(mockUserId);

      expect(result).toEqual(['workspace-1', 'workspace-2', 'workspace-3']);
    });

    it('should return empty array when user not found', async () => {
      const userDoc = {
        exists: false,
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: () => ({
              get: async () => userDoc,
            }),
          };
        }
      });

      const result = await getUserWorkspaceIds(mockUserId);

      expect(result).toEqual([]);
    });
  });
});
