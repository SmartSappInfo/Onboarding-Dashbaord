// @ts-nocheck
/**
 * Unit Tests for Onboarding Server Actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminDb } from '../firebase-admin';
import { validateJoinCodeAction, submitOnboardingProfileAction, enforceSuperAdminProfileAction } from '../../app/actions/onboarding-actions';

// Mock adminDb
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('validateJoinCodeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if code is empty', async () => {
    const result = await validateJoinCodeAction('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Please enter an organization join code.');
  });

  it('should find organization by slug', async () => {
    const mockQuerySnapshot = {
      empty: false,
      docs: [{
        id: 'org_slug_id',
        data: () => ({ name: 'Test Org Slug', slug: 'test-org' })
      }]
    };

    const mockCollection = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(mockQuerySnapshot)
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'organizations') return mockCollection;
      return {};
    });

    const result = await validateJoinCodeAction('test-org');

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe('org_slug_id');
    expect(result.organizationName).toBe('Test Org Slug');
  });

  it('should find organization by joinToken if slug search is empty', async () => {
    const mockEmptySnapshot = { empty: true };
    const mockTokenSnapshot = {
      empty: false,
      docs: [{
        id: 'org_token_id',
        data: () => ({ name: 'Test Org Token', joinToken: 'TOKEN123' })
      }]
    };

    // Chain 1: slug check (returns empty), Chain 2: token check (returns org)
    const mockCollection = {
      where: vi.fn()
        .mockReturnValueOnce({
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(mockEmptySnapshot)
        })
        .mockReturnValueOnce({
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(mockTokenSnapshot)
        })
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'organizations') return mockCollection;
      return {};
    });

    const result = await validateJoinCodeAction('TOKEN123');

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe('org_token_id');
    expect(result.organizationName).toBe('Test Org Token');
  });

  it('should return error if organization does not exist', async () => {
    const mockEmptySnapshot = { empty: true };
    const mockDocSnapshot = { exists: false };

    const mockCollection = {
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockEmptySnapshot)
      }),
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDocSnapshot)
      })
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'organizations') return mockCollection;
      return {};
    });

    const result = await validateJoinCodeAction('non-existent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No organization matches the provided Join Code/Token.');
  });
});

describe('submitOnboardingProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save user onboarding details and map workspace IDs', async () => {
    const mockUserDoc = {
      exists: true,
      data: () => ({ email: 'user@example.com' })
    };

    const mockUserDocRef = {
      get: vi.fn().mockResolvedValue(mockUserDoc),
      set: vi.fn().mockResolvedValue(undefined)
    };

    const mockWorkspacesSnapshot = {
      docs: [
        { id: 'workspace_1' },
        { id: 'workspace_2' }
      ]
    };

    const mockWorkspacesQuery = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(mockWorkspacesSnapshot)
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: vi.fn().mockReturnValue(mockUserDocRef)
        };
      }
      if (name === 'workspaces') {
        return mockWorkspacesQuery;
      }
      return {};
    });

    const result = await submitOnboardingProfileAction({
      userId: 'user_123',
      name: 'Jane Doe',
      phone: '+23312345678',
      department: 'operations',
      organizationId: 'org_1',
      notificationPreferences: {
        email: true,
        sms: true,
        inApp: false,
        push: false
      }
    });

    expect(result.success).toBe(true);
    expect(mockUserDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user_123',
        name: 'Jane Doe',
        phone: '+23312345678',
        department: 'operations',
        organizationId: 'org_1',
        workspaceIds: ['workspace_1', 'workspace_2'],
        profileCompleted: true,
        isAuthorized: false,
        approvalStatus: 'pending'
      }),
      { merge: true }
    );
  });
});

describe('enforceSuperAdminProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isSuperAdmin false if email is not in config', async () => {
    const mockConfigSnapshot = {
      exists: true,
      data: () => ({ emails: ['super@smartsapp.com'] })
    };

    const mockCollection = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(mockConfigSnapshot)
      })
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'system_config') return mockCollection;
      return {};
    });

    const result = await enforceSuperAdminProfileAction('user_123', 'other@smartsapp.com', 'Other User');

    expect(result.success).toBe(true);
    expect(result.isSuperAdmin).toBe(false);
  });

  it('should upgrade and save user profile if email matches super admin config', async () => {
    const mockConfigSnapshot = {
      exists: true,
      data: () => ({ emails: ['super@smartsapp.com'] })
    };

    const mockUserDoc = {
      exists: true,
      data: () => ({ name: 'Old Name', email: 'super@smartsapp.com' })
    };

    const mockUserDocRef = {
      get: vi.fn().mockResolvedValue(mockUserDoc),
      set: vi.fn().mockResolvedValue(undefined)
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'system_config') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockConfigSnapshot)
          })
        };
      }
      if (name === 'users') {
        return {
          doc: vi.fn().mockReturnValue(mockUserDocRef)
        };
      }
      return {};
    });

    const result = await enforceSuperAdminProfileAction('user_123', 'super@smartsapp.com', 'New Name');

    expect(result.success).toBe(true);
    expect(result.isSuperAdmin).toBe(true);
    expect(mockUserDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user_123',
        name: 'New Name',
        email: 'super@smartsapp.com',
        isAuthorized: true,
        profileCompleted: true,
        approvalStatus: 'approved',
        organizationId: 'smartsapp-hq',
        roles: ['administrator'],
        permissions: expect.arrayContaining(['system_admin'])
      }),
      { merge: true }
    );
  });
});
