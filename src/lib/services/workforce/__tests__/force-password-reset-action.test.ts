import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeForcePasswordResetAction } from '@/lib/user-invite-actions';

// Mock dependencies
const mockVerifyIdToken = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    updateUser: mockUpdateUser,
  })),
}));

const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((id: string) => ({
        get: () => mockDocGet(colName, id),
        update: (data: unknown) => mockDocUpdate(colName, id, data),
      })),
    })),
  },
}));

vi.mock('@/lib/resend-service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/mnotify-service', () => ({
  sendSms: vi.fn(),
}));

vi.mock('@/lib/services/workforce/invitation-dispatch-service', () => ({
  InvitationDispatchService: {
    dispatch: vi.fn(),
    dispatchUserCredentials: vi.fn(),
    dispatchPasswordReset: vi.fn(),
  },
}));

describe('completeForcePasswordResetAction Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if idToken is missing', async () => {
    const result = await completeForcePasswordResetAction({
      idToken: '',
      newPassword: 'ValidPassword123!',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Missing authentication token');
  });

  it('rejects if newPassword is shorter than 8 characters', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'usr-123' });

    const result = await completeForcePasswordResetAction({
      idToken: 'fake-id-token',
      newPassword: 'short',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('at least 8 characters');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('successfully updates auth password, clears requiresPasswordReset flag, and routes invited user with incomplete profile to /profile-setup', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'usr-regular-001' });
    mockUpdateUser.mockResolvedValueOnce(undefined);

    mockDocGet.mockImplementation((col: string, _id: string) => {
      if (col === 'users') {
        return Promise.resolve({
          exists: true,
          data: () => ({
            id: 'usr-regular-001',
            email: 'employee@company.com',
            name: 'Regular Employee',
            role: 'member',
            permissions: ['dashboard.view'],
            requiresPasswordReset: true,
            profileCompleted: false,
          }),
        });
      }
      return Promise.resolve({ exists: false });
    });

    const result = await completeForcePasswordResetAction({
      idToken: 'valid-jwt-token',
      newPassword: 'BrandNewSecurePassword123!',
    });

    expect(result.success).toBe(true);
    expect(result.redirectTo).toBe('/profile-setup');
    expect(mockUpdateUser).toHaveBeenCalledWith('usr-regular-001', {
      password: 'BrandNewSecurePassword123!',
    });
    expect(mockDocUpdate).toHaveBeenCalledWith(
      'users',
      'usr-regular-001',
      expect.objectContaining({
        requiresPasswordReset: false,
      })
    );
  });

  it('routes user to /admin if profile has already been completed', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'usr-completed-001' });
    mockUpdateUser.mockResolvedValueOnce(undefined);

    mockDocGet.mockImplementation((col: string, _id: string) => {
      if (col === 'users') {
        return Promise.resolve({
          exists: true,
          data: () => ({
            id: 'usr-completed-001',
            email: 'employee@company.com',
            name: 'Regular Employee',
            role: 'member',
            permissions: ['dashboard.view'],
            requiresPasswordReset: true,
            profileCompleted: true,
          }),
        });
      }
      return Promise.resolve({ exists: false });
    });

    const result = await completeForcePasswordResetAction({
      idToken: 'valid-jwt-token',
      newPassword: 'BrandNewSecurePassword123!',
    });

    expect(result.success).toBe(true);
    expect(result.redirectTo).toBe('/admin');
  });

  it('routes system_admin / superAdmin to /admin/settings/organizations after resetting password', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'usr-admin-001' });
    mockUpdateUser.mockResolvedValueOnce(undefined);

    mockDocGet.mockImplementation((col: string, _id: string) => {
      if (col === 'users') {
        return Promise.resolve({
          exists: true,
          data: () => ({
            id: 'usr-admin-001',
            email: 'admin@company.com',
            role: 'system_admin',
            permissions: ['system_admin'],
            requiresPasswordReset: true,
          }),
        });
      }
      return Promise.resolve({ exists: false });
    });

    const result = await completeForcePasswordResetAction({
      idToken: 'valid-admin-token',
      newPassword: 'AdminSecurePassword456!',
    });

    expect(result.success).toBe(true);
    expect(result.redirectTo).toBe('/admin/settings/organizations');
    expect(mockDocUpdate).toHaveBeenCalledWith(
      'users',
      'usr-admin-001',
      expect.objectContaining({
        requiresPasswordReset: false,
      })
    );
  });

  it('returns failure when token verification fails', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Firebase ID token has expired.'));

    const result = await completeForcePasswordResetAction({
      idToken: 'expired-token',
      newPassword: 'ValidPassword123!',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Firebase ID token has expired.');
  });
});
