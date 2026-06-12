// @ts-nocheck
/**
 * Unit Tests for Onboarding Server Actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminDb } from '../firebase-admin';
import { 
  validateJoinCodeAction, 
  submitOnboardingProfileAction, 
  enforceSuperAdminProfileAction,
  completeOrganizationOnboardingAction
} from '../../app/actions/onboarding-actions';

const mockTransaction = {
  get: vi.fn(),
  update: vi.fn(),
  set: vi.fn()
};

// Mock adminDb with runTransaction support
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
    runTransaction: vi.fn((callback) => callback(mockTransaction)),
    batch: vi.fn()
  },
}));

// Helper to construct a robust chainable collection mock for Firestore queries
function createMockCollection(options: {
  slugSnap?: any;
  prefixSnap?: any;
  tokenSnap?: any;
  docSnap?: any;
}) {
  const slugSnap = options.slugSnap || { empty: true };
  const prefixSnap = options.prefixSnap || { empty: true };
  const tokenSnap = options.tokenSnap || { empty: true };
  const docSnap = options.docSnap || { exists: false };

  const collection = {
    where: vi.fn().mockImplementation((field, op, val) => {
      if (field === 'slug') {
        return {
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(slugSnap)
        };
      }
      if (field === 'joinToken') {
        return {
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(tokenSnap)
        };
      }
      return {
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true })
      };
    }),
    orderBy: vi.fn().mockReturnThis(),
    startAt: vi.fn().mockReturnThis(),
    endAt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(prefixSnap),
    doc: vi.fn().mockImplementation((id) => ({
      id,
      get: vi.fn().mockResolvedValue(docSnap)
    }))
  };

  return collection;
}

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
    const mockCollection = createMockCollection({
      slugSnap: {
        empty: false,
        docs: [{
          id: 'org_slug_id',
          data: () => ({ name: 'Test Org Slug', slug: 'test-org', isConfigured: false })
        }]
      }
    });

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'organizations') return mockCollection;
      return {};
    });

    const result = await validateJoinCodeAction('test-org');

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe('org_slug_id');
    expect(result.organizationName).toBe('Test Org Slug');
    expect(result.isConfigured).toBe(false);
  });

  it('should find organization by joinToken if slug search is empty', async () => {
    const mockCollection = createMockCollection({
      slugSnap: { empty: true },
      prefixSnap: { empty: true },
      tokenSnap: {
        empty: false,
        docs: [{
          id: 'org_token_id',
          data: () => ({ name: 'Test Org Token', joinToken: 'TOKEN123', isConfigured: true })
        }]
      }
    });

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'organizations') return mockCollection;
      return {};
    });

    const result = await validateJoinCodeAction('TOKEN123');

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe('org_token_id');
    expect(result.organizationName).toBe('Test Org Token');
    expect(result.isConfigured).toBe(true);
  });

  it('should return error if organization does not exist', async () => {
    const mockCollection = createMockCollection({
      slugSnap: { empty: true },
      prefixSnap: { empty: true },
      tokenSnap: { empty: true },
      docSnap: { exists: false }
    });

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

describe('completeOrganizationOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if userId is missing', async () => {
    const result = await completeOrganizationOnboardingAction({
      userId: '',
      organizationId: 'org_1',
      branding: {
        primaryColor: '#10b981',
        secondaryColor: '#3b82f6',
        fontFamily: 'Inter',
        settings: { defaultLanguage: 'en', timezone: 'UTC', currency: 'USD' }
      },
      workspace: { name: 'Workspace 1', contactScope: 'person', industry: 'SaaS' }
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('User ID is required.');
  });

  it('should return ALREADY_CONFIGURED if organization.isConfigured is already true', async () => {
    const mockUserSnap = {
      exists: true,
      data: () => ({ organizationId: 'org_1' })
    };
    const mockOrgSnap = {
      exists: true,
      data: () => ({ isConfigured: true })
    };

    mockTransaction.get.mockImplementation(async (ref) => {
      if (ref.id === 'user_123') return mockUserSnap;
      if (ref.id === 'org_1') return mockOrgSnap;
      return { exists: false };
    });

    const mockCollection = {
      doc: vi.fn((id) => ({ id }))
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'users' || name === 'organizations') return mockCollection;
      return {};
    });

    const result = await completeOrganizationOnboardingAction({
      userId: 'user_123',
      organizationId: 'org_1',
      branding: {
        primaryColor: '#10b981',
        secondaryColor: '#3b82f6',
        fontFamily: 'Inter',
        settings: { defaultLanguage: 'en', timezone: 'UTC', currency: 'USD' }
      },
      workspace: { name: 'Workspace 1', contactScope: 'person', industry: 'SaaS' }
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('ALREADY_CONFIGURED');
  });

  it('should transactionally complete organization onboarding and provision workspace', async () => {
    const mockUserSnap = {
      exists: true,
      data: () => ({ organizationId: 'org_1', workspaceIds: [] })
    };
    const mockOrgSnap = {
      exists: true,
      data: () => ({ isConfigured: false, name: 'Acme Corp' })
    };

    mockTransaction.get.mockImplementation(async (ref) => {
      if (ref.id === 'user_123') return mockUserSnap;
      if (ref.id === 'org_1') return mockOrgSnap;
      return { exists: false };
    });

    const mockCollection = {
      doc: vi.fn((id) => ({ id }))
    };

    const mockWorkspaceRef = { id: 'workspace_abc' };
    const mockWorkspacesCollection = {
      doc: vi.fn().mockReturnValue(mockWorkspaceRef)
    };

    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'users' || name === 'organizations') return mockCollection;
      if (name === 'workspaces') return mockWorkspacesCollection;
      return {};
    });

    const result = await completeOrganizationOnboardingAction({
      userId: 'user_123',
      organizationId: 'org_1',
      branding: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#3b82f6',
        fontFamily: 'Outfit',
        settings: { defaultLanguage: 'fr', timezone: 'Europe/Paris', currency: 'EUR' }
      },
      workspace: { name: 'Acme Workspace', contactScope: 'institution', industry: 'SaaS' }
    });

    expect(result.success).toBe(true);
    expect(result.workspaceId).toBe('workspace_abc');
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'settings.defaultLanguage': 'fr',
        'settings.timezone': 'Europe/Paris',
        'settings.branding.primaryColor': '#8b5cf6',
        isConfigured: true
      })
    );
    expect(mockTransaction.set).toHaveBeenCalledWith(
      mockWorkspaceRef,
      expect.objectContaining({
        id: 'workspace_abc',
        organizationId: 'org_1',
        name: 'Acme Workspace',
        contactScope: 'institution',
        industry: 'SaaS',
        status: 'active'
      })
    );
  });
});
