// @ts-nocheck
/**
 * Unit Tests for Onboarding Server Actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminAuth, adminDb } from '../firebase-admin';
import { DepartmentService } from '../services/workforce/department-service';
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
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
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
    where: vi.fn().mockImplementation((field, _op, _val) => {
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
  /**
   * Firestore for one submission: the caller's existing user doc (or none), the target
   * organization (`null` = does not exist) and its workspaces.
   */
  function arrange(opts: { existingUser?: Record<string, unknown>; org?: Record<string, unknown> | null; workspaceIds?: string[] }) {
    const userSet = vi.fn().mockResolvedValue(undefined);
    const usersDoc = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: Boolean(opts.existingUser), data: () => opts.existingUser }),
      set: userSet,
    });
    (adminDb.collection as any).mockImplementation((name) => {
      if (name === 'users') return { doc: usersDoc };
      if (name === 'workspaces') {
        return { where: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ docs: (opts.workspaceIds ?? []).map((id) => ({ id })) }) };
      }
      if (name === 'organizations') {
        return { doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: opts.org !== null, data: () => opts.org ?? undefined }) }) };
      }
      if (name === 'departments') {
        return { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ docs: [] }) };
      }
      return {};
    });
    return { userSet, usersDoc };
  }
  const signedInAs = (uid: string) => (adminAuth.verifyIdToken as any).mockResolvedValue({ uid });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save user onboarding details and map workspace IDs', async () => {
    const { userSet: set } = arrange({
      existingUser: { email: 'user@example.com' },
      org: { name: 'Org 1', isConfigured: true },
      workspaceIds: ['workspace_1', 'workspace_2'],
    });
    const mockUserDocRef = { set };
    signedInAs('user_123');

    const result = await submitOnboardingProfileAction({
      idToken: 'token_user_123',
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
    expect(result.isAuthorized).toBe(false);
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

  it('should preserve isAuthorized: true and approvalStatus: approved for invited members', async () => {
    // Invited members carry the inviting organization, and keep their approval for it.
    const { userSet: set } = arrange({
      existingUser: { email: 'invited@example.com', organizationId: 'org_1', isAuthorized: true, approvalStatus: 'approved' },
      org: { name: 'Test Org', isConfigured: true },
      workspaceIds: ['workspace_1'],
    });
    const mockUserDocRef = { set };
    signedInAs('user_invited_456');

    const result = await submitOnboardingProfileAction({
      idToken: 'token_user_invited_456',
      name: 'Invited Member',
      phone: '+23312345679',
      department: 'engineering',
      organizationId: 'org_1'
    });

    expect(result.success).toBe(true);
    expect(result.isAuthorized).toBe(true);
    expect(mockUserDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user_invited_456',
        name: 'Invited Member',
        phone: '+23312345679',
        department: 'engineering',
        organizationId: 'org_1',
        profileCompleted: true,
        onboardingCompleted: true,
        isAuthorized: true,
        approvalStatus: 'approved'
      }),
      { merge: true }
    );
  });

  // SECURITY (hardening H1c): the user comes only from the verified token, an account cannot be
  // moved to another organization, and approval is never carried across organizations.
  describe('tenant and identity safety', () => {
    it('writes only the signed-in user from the token', async () => {
      const { usersDoc } = arrange({ existingUser: {}, org: { name: 'Org 1' } });
      signedInAs('real_uid');

      await submitOnboardingProfileAction({ idToken: 'token', name: 'Name', organizationId: 'org_1' });

      expect(usersDoc).toHaveBeenCalledWith('real_uid');
      expect(usersDoc).toHaveBeenCalledTimes(1);
    });

    it('refuses an invalid or missing token without writing', async () => {
      const { userSet } = arrange({ existingUser: {}, org: { name: 'Org 1' } });
      (adminAuth.verifyIdToken as any).mockRejectedValue(new Error('bad token'));

      expect(await submitOnboardingProfileAction({ idToken: 'forged', name: 'Name', organizationId: 'org_1' }))
        .toMatchObject({ success: false, error: 'Your session has expired. Please sign in again.' });
      expect(await submitOnboardingProfileAction({ idToken: '', name: 'Name', organizationId: 'org_1' }))
        .toMatchObject({ success: false });
      expect(userSet).not.toHaveBeenCalled();
    });

    it('never moves an account that already belongs to another organization', async () => {
      const { userSet } = arrange({
        existingUser: { organizationId: 'org_A', isAuthorized: true, approvalStatus: 'approved', workspaceIds: ['ws_a'] },
        org: { name: 'Org B' },
      });
      signedInAs('member_of_a');

      const result = await submitOnboardingProfileAction({ idToken: 'token', name: 'Name', organizationId: 'org_B' });

      expect(result).toMatchObject({ success: false, error: 'Your account already belongs to another organization.' });
      expect(userSet).not.toHaveBeenCalled();
    });

    it('does not treat approval without the same organization as pre-authorization', async () => {
      const { userSet } = arrange({ existingUser: { isAuthorized: true, approvalStatus: 'approved' }, org: { name: 'Org 1' } });
      signedInAs('no_org_user');

      const result = await submitOnboardingProfileAction({ idToken: 'token', name: 'Name', organizationId: 'org_1' });

      expect(result).toMatchObject({ success: true, isAuthorized: false });
      expect(userSet).toHaveBeenCalledWith(expect.objectContaining({ isAuthorized: false, approvalStatus: 'pending' }), { merge: true });
    });

    it('refuses an organization that does not exist', async () => {
      const { userSet } = arrange({ existingUser: {}, org: null });
      signedInAs('new_user');

      const result = await submitOnboardingProfileAction({ idToken: 'token', name: 'Name', organizationId: 'org_missing' });

      expect(result).toMatchObject({ success: false, error: 'Organization not found.' });
      expect(userSet).not.toHaveBeenCalled();
    });

    it('does not create departments during onboarding; an unknown name stays free text', async () => {
      const { userSet } = arrange({ existingUser: {}, org: { name: 'Org 1' } });
      signedInAs('new_user');
      const findOrCreate = vi.spyOn(DepartmentService, 'findOrCreateDepartmentByName');

      try {
        await submitOnboardingProfileAction({ idToken: 'token', name: 'Name', organizationId: 'org_1', department: 'Brand New Team' });

        expect(findOrCreate).not.toHaveBeenCalled();
        expect(userSet).toHaveBeenCalledWith(expect.objectContaining({ department: 'Brand New Team' }), { merge: true });
        expect(userSet.mock.calls[0][0]).not.toHaveProperty('departmentId');
      } finally {
        findOrCreate.mockRestore();
      }
    });
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
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'user_123', email: 'other@smartsapp.com', email_verified: true });

    const result = await enforceSuperAdminProfileAction('token_user_123', 'Other User');

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

    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'user_123', email: 'super@smartsapp.com', email_verified: true });

    const result = await enforceSuperAdminProfileAction('token_user_123', 'New Name');

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

  // SECURITY (hardening H1): the user and email come only from the verified ID token. The action
  // used to take them as parameters, so anyone could promote their own account to system_admin
  // by sending a listed address.
  describe('identity comes only from the verified token', () => {
    const superAdminConfig = () => ({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ emails: ['super@smartsapp.com'] }) }),
      }),
    });
    let usersDoc: ReturnType<typeof vi.fn>;
    let userSet: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      userSet = vi.fn().mockResolvedValue(undefined);
      usersDoc = vi.fn().mockReturnValue({ set: userSet });
      (adminDb.collection as any).mockImplementation((name) => {
        if (name === 'system_config') return superAdminConfig();
        if (name === 'users') return { doc: usersDoc };
        return {};
      });
    });

    it('promotes the token\'s own user, never another uid', async () => {
      (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'signed_in_uid', email: 'super@smartsapp.com', email_verified: true });

      const result = await enforceSuperAdminProfileAction('token', 'Name');

      expect(result.isSuperAdmin).toBe(true);
      expect(usersDoc).toHaveBeenCalledWith('signed_in_uid');
      expect(usersDoc).toHaveBeenCalledTimes(1);
    });

    it('does not promote a listed email that is not verified', async () => {
      (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'attacker', email: 'super@smartsapp.com', email_verified: false });

      const result = await enforceSuperAdminProfileAction('token', 'Name');

      expect(result).toMatchObject({ success: true, isSuperAdmin: false });
      expect(userSet).not.toHaveBeenCalled();
    });

    it('refuses an invalid or missing token without writing anything', async () => {
      (adminAuth.verifyIdToken as any).mockRejectedValue(new Error('invalid token'));

      expect(await enforceSuperAdminProfileAction('forged', 'Name')).toMatchObject({ success: false, isSuperAdmin: false });
      expect(await enforceSuperAdminProfileAction('', 'Name')).toMatchObject({ success: false, isSuperAdmin: false });
      expect(userSet).not.toHaveBeenCalled();
    });
  });
});

describe('completeOrganizationOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses an invalid or missing token', async () => {
    (adminAuth.verifyIdToken as any).mockRejectedValue(new Error('bad token'));
    const result = await completeOrganizationOnboardingAction({
      idToken: 'forged',
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
    expect(result.error).toBe('Your session has expired. Please sign in again.');
    expect(mockTransaction.update).not.toHaveBeenCalled();
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

    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'user_123' });
    const result = await completeOrganizationOnboardingAction({
      idToken: 'token_user_123',
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
    // The invited first admin: an approved member of the organization being set up.
    const mockUserSnap = {
      exists: true,
      data: () => ({ organizationId: 'org_1', workspaceIds: [], isAuthorized: true, approvalStatus: 'approved' })
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

    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'user_123' });
    const result = await completeOrganizationOnboardingAction({
      idToken: 'token_user_123',
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

    // The owner becomes ORGANIZATION admin: the org admin set and full schema, never the
    // platform-wide system_admin token (hardening H1c).
    const userUpdate = mockTransaction.update.mock.calls
      .map(([, data]) => data)
      .find((data) => data.roles !== undefined);
    expect(userUpdate).toMatchObject({ organizationId: 'org_1', isAuthorized: true, roles: ['administrator'] });
    expect(userUpdate.permissions).toEqual(expect.arrayContaining(['finance_manage', 'studios_edit']));
    expect(userUpdate.permissions).not.toContain('system_admin');
    expect(userUpdate.permissionsSchema).toBeDefined();
  });

  // SECURITY (hardening H1c): only an approved member of the organization being set up (the
  // invited first admin) may complete it. Anyone else could make themselves its administrator.
  describe('who may complete setup', () => {
    const arrangeSetup = (userData: Record<string, unknown>) => {
      mockTransaction.get.mockImplementation(async (ref) => {
        if (ref.id === 'caller') return { exists: true, data: () => userData };
        if (ref.id === 'org_1') return { exists: true, data: () => ({ isConfigured: false }) };
        return { exists: false };
      });
      (adminDb.collection as any).mockImplementation((name) => {
        if (name === 'users' || name === 'organizations') return { doc: vi.fn((id) => ({ id })) };
        if (name === 'workspaces') return { doc: vi.fn().mockReturnValue({ id: 'ws_new' }) };
        return {};
      });
      (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller' });
    };
    const complete = () => completeOrganizationOnboardingAction({ idToken: 'token', organizationId: 'org_1', workspace: { name: 'WS' } });

    it('refuses a user from another organization', async () => {
      arrangeSetup({ organizationId: 'org_other', isAuthorized: true, approvalStatus: 'approved' });
      expect(await complete()).toMatchObject({ success: false, error: 'Only an approved member of this organization can complete its setup.' });
      expect(mockTransaction.update).not.toHaveBeenCalled();
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('refuses a member who is not approved yet', async () => {
      arrangeSetup({ organizationId: 'org_1', isAuthorized: false, approvalStatus: 'pending' });
      expect(await complete()).toMatchObject({ success: false });
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });
});
