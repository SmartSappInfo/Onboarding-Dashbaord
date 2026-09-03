import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUserAction } from '@/lib/user-invite-actions';

// Mock Auth
const mockCreateUser = vi.fn();
const mockGetUserByEmail = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    createUser: mockCreateUser,
    getUserByEmail: mockGetUserByEmail,
  })),
}));

// Mock Firestore
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((id: string) => ({
        get: () => mockDocGet(colName, id),
        set: (data: unknown, opts: unknown) => mockDocSet(colName, id, data, opts),
      })),
    })),
  },
}));

// Mock Dispatch Service
const mockDispatchUserCredentials = vi.fn().mockResolvedValue({
  success: true,
  channels: {
    email: { sent: true },
    sms: { sent: false },
    whatsapp: { sent: false },
  },
  warnings: [],
});

vi.mock('@/lib/services/workforce/invitation-dispatch-service', () => ({
  InvitationDispatchService: {
    dispatchUserCredentials: (...args: unknown[]) => mockDispatchUserCredentials(...args),
  },
}));

// Mock Identity Migration Service
const mockGetOrMigratePerson = vi.fn().mockResolvedValue({ id: 'mock-person' });

vi.mock('@/lib/services/identity/identity-migration-service', () => ({
  IdentityMigrationService: {
    getOrMigratePerson: (...args: unknown[]) => mockGetOrMigratePerson(...args),
  },
}));

describe('inviteUserAction Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully creates user with assigned department and multiple workspaces', async () => {
    // 1. Mock user does not exist in Auth
    mockGetUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    mockCreateUser.mockResolvedValue({
      uid: 'user_new_123',
      email: 'newhire@company.com',
      displayName: 'Alice Engineer',
    });

    // 2. Mock Organization and Roles in Firestore
    mockDocGet.mockImplementation((colName: string, _id: string) => {
      if (colName === 'organizations') {
        return Promise.resolve({
          exists: true,
          data: () => ({ name: 'Acme Innovations', isConfigured: true }),
        });
      }
      if (colName === 'roles') {
        return Promise.resolve({
          exists: true,
          data: () => ({
            name: 'Senior Developer',
            permissions: ['view_deals', 'edit_deals'],
          }),
        });
      }
      return Promise.resolve({ exists: false, data: () => ({}) });
    });

    const result = await inviteUserAction({
      fullName: 'Alice Engineer',
      email: 'newhire@company.com',
      phone: '+233241234567',
      department: 'Engineering',
      workspaceIds: ['ws_engineering', 'ws_core_product'],
      workspaceRoles: {
        ws_engineering: ['role_dev_1'],
        ws_core_product: ['role_dev_1'],
      },
      organizationId: 'org_acme_1',
      sendMethods: ['email'],
    });

    expect(result.success).toBe(true);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newhire@company.com',
        displayName: 'Alice Engineer',
      })
    );

    // Verify Firestore user record has department and multiple workspaceIds
    expect(mockDocSet).toHaveBeenCalledWith(
      'users',
      'user_new_123',
      expect.objectContaining({
        id: 'user_new_123',
        name: 'Alice Engineer',
        email: 'newhire@company.com',
        phone: '+233241234567',
        department: 'Engineering',
        workspaceIds: ['ws_engineering', 'ws_core_product'],
        organizationId: 'org_acme_1',
        isAuthorized: true,
        approvalStatus: 'approved',
        profileCompleted: false,
        onboardingCompleted: false,
      }),
      { merge: true }
    );

    // Verify Person Graph sync was called
    expect(mockGetOrMigratePerson).toHaveBeenCalledWith('user_new_123', 'org_acme_1');

    // Verify credentials dispatch
    expect(mockDispatchUserCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_new_123',
        email: 'newhire@company.com',
        channels: ['email'],
      })
    );
  });

  it('falls back to General department and workspaceRoles keys if workspaceIds not explicitly provided', async () => {
    mockGetUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    mockCreateUser.mockResolvedValue({
      uid: 'user_fallback_456',
      email: 'general@company.com',
      displayName: 'Bob Operations',
    });

    mockDocGet.mockImplementation((colName: string) => {
      if (colName === 'organizations') {
        return Promise.resolve({
          exists: true,
          data: () => ({ name: 'Acme Innovations' }),
        });
      }
      return Promise.resolve({ exists: false, data: () => ({}) });
    });

    const result = await inviteUserAction({
      fullName: 'Bob Operations',
      email: 'general@company.com',
      workspaceRoles: {
        ws_default: ['role_member'],
      },
      organizationId: 'org_acme_1',
      sendMethods: ['email'],
    });

    expect(result.success).toBe(true);
    expect(mockDocSet).toHaveBeenCalledWith(
      'users',
      'user_fallback_456',
      expect.objectContaining({
        department: 'General',
        workspaceIds: ['ws_default'],
        isAuthorized: true,
        approvalStatus: 'approved',
      }),
      { merge: true }
    );
  });
});
