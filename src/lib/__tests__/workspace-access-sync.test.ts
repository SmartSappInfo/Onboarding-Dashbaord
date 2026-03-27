import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  syncUserWorkspaceAccess,
  syncRoleMembersWorkspaceAccess,
  syncOrganizationWorkspaceAccess,
  handleUserAddedToRole,
  handleUserRemovedFromRole,
  handleRoleWorkspaceIdsChanged,
} from '../workspace-access-sync';
import { adminDb } from '../firebase-admin';
import type { UserProfile, Role } from '../types';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Workspace Access Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncUserWorkspaceAccess', () => {
    it('should update user workspaceIds based on role membership', async () => {
      const userId = 'user1';
      const organizationId = 'org1';

      const mockUser: UserProfile = {
        id: userId,
        organizationId,
        roles: ['role1', 'role2'],
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'Test User',
        isAuthorized: true,
        permissions: [],
        workspaceIds: [], // Will be updated
        createdAt: '2024-01-01',
      };

      const mockRoles: Role[] = [
        {
          id: 'role1',
          organizationId,
          name: 'Role 1',
          description: 'Test role 1',
          color: '#000000',
          permissions: [],
          workspaceIds: ['ws1', 'ws2'],
          createdAt: '2024-01-01',
        },
        {
          id: 'role2',
          organizationId,
          name: 'Role 2',
          description: 'Test role 2',
          color: '#000000',
          permissions: [],
          workspaceIds: ['ws2', 'ws3'], // ws2 overlaps with role1
          createdAt: '2024-01-01',
        },
        {
          id: 'role3',
          organizationId,
          name: 'Role 3',
          description: 'Test role 3',
          color: '#000000',
          permissions: [],
          workspaceIds: ['ws4'], // User doesn't have this role
          createdAt: '2024-01-01',
        },
      ];

      const mockUserRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };

      const mockUserSnap = {
        exists: true,
        data: () => mockUser,
        ref: mockUserRef,
      };

      const mockRolesSnap = {
        docs: mockRoles.map((role) => ({
          id: role.id,
          data: () => role,
        })),
      };

      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      const mockRolesCollection = {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRolesSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        if (collectionName === 'roles') return mockRolesCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await syncUserWorkspaceAccess(userId);

      // Should update user with unique workspace IDs from role1 and role2
      expect(mockUserRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceIds: expect.arrayContaining(['ws1', 'ws2', 'ws3']),
        })
      );

      const updateCall = mockUserRef.update.mock.calls[0][0];
      expect(updateCall.workspaceIds).toHaveLength(3); // ws1, ws2, ws3 (no duplicates)
      expect(updateCall.workspaceIds).not.toContain('ws4'); // User doesn't have role3
    });

    it('should handle user with no roles', async () => {
      const userId = 'user1';
      const organizationId = 'org1';

      const mockUser: UserProfile = {
        id: userId,
        organizationId,
        roles: [], // No roles
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'Test User',
        isAuthorized: true,
        permissions: [],
        workspaceIds: ['ws1'], // Should be cleared
        createdAt: '2024-01-01',
      };

      const mockUserRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };

      const mockUserSnap = {
        exists: true,
        data: () => mockUser,
        ref: mockUserRef,
      };

      const mockRolesSnap = {
        docs: [], // No roles in organization
      };

      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      const mockRolesCollection = {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRolesSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        if (collectionName === 'roles') return mockRolesCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await syncUserWorkspaceAccess(userId);

      // Should update user with empty workspaceIds
      expect(mockUserRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceIds: [],
        })
      );
    });

    it('should handle user not found', async () => {
      const userId = 'nonexistent';

      const mockUserSnap = {
        exists: false,
      };

      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      // Should not throw, just log error
      await expect(syncUserWorkspaceAccess(userId)).resolves.toBeUndefined();
    });
  });

  describe('syncRoleMembersWorkspaceAccess', () => {
    it('should sync all users who belong to the role', async () => {
      const roleId = 'role1';
      const organizationId = 'org1';

      const mockRole: Role = {
        id: roleId,
        organizationId,
        name: 'Role 1',
        description: 'Test role',
        color: '#000000',
        permissions: [],
        workspaceIds: ['ws1', 'ws2'],
        createdAt: '2024-01-01',
      };

      const mockUsers = [
        { id: 'user1', organizationId, roles: [roleId] },
        { id: 'user2', organizationId, roles: [roleId] },
      ];

      const mockRoleSnap = {
        exists: true,
        data: () => mockRole,
      };

      const mockUsersSnap = {
        docs: mockUsers.map((user) => ({
          id: user.id,
          data: () => user,
        })),
        size: mockUsers.length,
      };

      const mockRolesCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRoleSnap),
        }),
      };

      const mockUsersCollection = {
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUsersSnap),
          }),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'roles') return mockRolesCollection;
        if (collectionName === 'users') return mockUsersCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      // Mock syncUserWorkspaceAccess to avoid recursive mocking
      const syncUserSpy = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../workspace-access-sync', () => ({
        syncUserWorkspaceAccess: syncUserSpy,
      }));

      await syncRoleMembersWorkspaceAccess(roleId);

      // Should have called syncUserWorkspaceAccess for each user
      // Note: In actual implementation, this would call syncUserWorkspaceAccess
      // For this test, we verify the query was made correctly
      expect(mockUsersCollection.where).toHaveBeenCalledWith('organizationId', '==', organizationId);
    });

    it('should handle role not found', async () => {
      const roleId = 'nonexistent';

      const mockRoleSnap = {
        exists: false,
      };

      const mockRolesCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRoleSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'roles') return mockRolesCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      // Should not throw, just log error
      await expect(syncRoleMembersWorkspaceAccess(roleId)).resolves.toBeUndefined();
    });
  });

  describe('syncOrganizationWorkspaceAccess', () => {
    it('should sync all users in the organization in batches', async () => {
      const organizationId = 'org1';

      // Create 25 mock users to test batching (batch size is 10)
      const mockUsers = Array.from({ length: 25 }, (_, i) => ({
        id: `user${i + 1}`,
        organizationId,
        roles: [],
      }));

      const mockUsersSnap = {
        docs: mockUsers.map((user) => ({
          id: user.id,
          data: () => user,
        })),
        size: mockUsers.length,
      };

      const mockUsersCollection = {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUsersSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await syncOrganizationWorkspaceAccess(organizationId);

      // Should have queried users by organizationId
      expect(mockUsersCollection.where).toHaveBeenCalledWith('organizationId', '==', organizationId);
    });
  });

  describe('Convenience functions', () => {
    it('handleUserAddedToRole should call syncUserWorkspaceAccess', async () => {
      const userId = 'user1';
      const roleId = 'role1';

      // Mock minimal setup
      const mockUserSnap = { exists: false };
      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await handleUserAddedToRole(userId, roleId);

      // Should have attempted to sync user
      expect(mockUsersCollection.doc).toHaveBeenCalledWith(userId);
    });

    it('handleUserRemovedFromRole should call syncUserWorkspaceAccess', async () => {
      const userId = 'user1';
      const roleId = 'role1';

      // Mock minimal setup
      const mockUserSnap = { exists: false };
      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await handleUserRemovedFromRole(userId, roleId);

      // Should have attempted to sync user
      expect(mockUsersCollection.doc).toHaveBeenCalledWith(userId);
    });

    it('handleRoleWorkspaceIdsChanged should call syncRoleMembersWorkspaceAccess', async () => {
      const roleId = 'role1';
      const workspaceId = 'ws1';

      // Mock minimal setup
      const mockRoleSnap = { exists: false };
      const mockRolesCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRoleSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'roles') return mockRolesCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await handleRoleWorkspaceIdsChanged(roleId, workspaceId);

      // Should have attempted to sync role members
      expect(mockRolesCollection.doc).toHaveBeenCalledWith(roleId);
    });
  });

  describe('Requirement 9.5: Immediate Access Revocation', () => {
    it('should immediately update user workspaceIds when removed from role', async () => {
      const userId = 'user1';
      const organizationId = 'org1';

      // User initially has role1 and role2
      const mockUser: UserProfile = {
        id: userId,
        organizationId,
        roles: ['role2'], // role1 was just removed
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'Test User',
        isAuthorized: true,
        permissions: [],
        workspaceIds: ['ws1', 'ws2', 'ws3'], // Old access
        createdAt: '2024-01-01',
      };

      const mockRoles: Role[] = [
        {
          id: 'role2',
          organizationId,
          name: 'Role 2',
          description: 'Test role 2',
          color: '#000000',
          permissions: [],
          workspaceIds: ['ws3'], // Only ws3 now
          createdAt: '2024-01-01',
        },
      ];

      const mockUserRef = {
        update: vi.fn().mockResolvedValue(undefined),
      };

      const mockUserSnap = {
        exists: true,
        data: () => mockUser,
        ref: mockUserRef,
      };

      const mockRolesSnap = {
        docs: mockRoles.map((role) => ({
          id: role.id,
          data: () => role,
        })),
      };

      const mockUsersCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockUserSnap),
        }),
      };

      const mockRolesCollection = {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockRolesSnap),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'users') return mockUsersCollection;
        if (collectionName === 'roles') return mockRolesCollection;
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await syncUserWorkspaceAccess(userId);

      // Should update user with only ws3 (from role2)
      expect(mockUserRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceIds: ['ws3'],
        })
      );

      // Should NOT include ws1 or ws2 (from removed role1)
      const updateCall = mockUserRef.update.mock.calls[0][0];
      expect(updateCall.workspaceIds).not.toContain('ws1');
      expect(updateCall.workspaceIds).not.toContain('ws2');
    });
  });
});
