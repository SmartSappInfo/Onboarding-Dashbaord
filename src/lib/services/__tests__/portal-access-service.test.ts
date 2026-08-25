import { describe, it, expect } from 'vitest';
import { PortalAccessService } from '../portal-access-service';
import type { Portal } from '../../types/portal';

describe('PortalAccessService', () => {
  const mockPortal: Portal = {
    id: 'portal-123',
    organizationId: 'org-test',
    workspaceIds: ['ws-1'],
    name: 'Test Academy',
    slug: 'test-academy',
    description: 'Test Academy Portal',
    primaryMode: 'academy',
    enabledModes: ['academy'],
    status: 'published',
    visibility: 'public',
    branding: {
      brandName: 'Test Academy',
      copyrightText: '© 2026',
    },
    theme: {
      colors: {
        primary: '#3B82F6',
        secondary: '#1E293B',
        accent: '#6366F1',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#0F172A',
        mutedText: '#64748B',
        border: '#E2E8F0',
      },
      typography: {
        headingFont: 'Plus Jakarta Sans',
        bodyFont: 'Inter',
        baseSize: 'md',
      },
      ui: {
        borderRadius: 'lg',
        buttonStyle: 'flat',
      },
      colorMode: 'system',
    },
    navigation: {
      headerItems: [],
      headerActions: { showLoginButton: false, showSearch: false },
      sidebarItems: [],
      footerColumns: [],
      socialLinks: [],
    },
    accessPolicy: {
      visibility: 'public',
      requireAuth: false,
      allowedRoles: [],
      passwordProtected: false,
    },
    features: {
      enableCourses: true,
      enableBlog: false,
      enableDocs: false,
      enableCommunity: false,
      enableResources: false,
      enableEvents: false,
      enableGamification: false,
      enableAiTutor: true,
      enableAffiliates: false,
    },
    seo: {},
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('Password Hashing & Verification', () => {
    it('hashes passwords consistently with salt', () => {
      const hash1 = PortalAccessService.hashPassword('secret123');
      const hash2 = PortalAccessService.hashPassword('secret123');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });

    it('verifies correct passwords and rejects incorrect ones', () => {
      const hash = PortalAccessService.hashPassword('masterclass2026');
      expect(PortalAccessService.verifyPassword('masterclass2026', hash)).toBe(true);
      expect(PortalAccessService.verifyPassword('wrongpassword', hash)).toBe(false);
      expect(PortalAccessService.verifyPassword('', hash)).toBe(false);
    });
  });

  describe('Access Policy Evaluation', () => {
    it('allows public access for published public portal', () => {
      const decision = PortalAccessService.evaluateAccess(mockPortal);
      expect(decision.allowed).toBe(true);
    });

    it('denies access if portal is not found', () => {
      const decision = PortalAccessService.evaluateAccess(null);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('not_found');
    });

    it('denies anonymous access to draft portals and allows admins', () => {
      const draftPortal: Portal = { ...mockPortal, status: 'draft' };

      const anonDecision = PortalAccessService.evaluateAccess(draftPortal);
      expect(anonDecision.allowed).toBe(false);
      expect(anonDecision.reason).toBe('draft');

      const adminDecision = PortalAccessService.evaluateAccess(draftPortal, { isSystemAdmin: true });
      expect(adminDecision.allowed).toBe(true);
    });

    it('denies anonymous access to suspended portals with custom reason', () => {
      const suspendedPortal: Portal = {
        ...mockPortal,
        status: 'suspended',
        accessPolicy: {
          ...mockPortal.accessPolicy,
          suspendedReason: 'Scheduled maintenance until 10am',
        },
      };

      const decision = PortalAccessService.evaluateAccess(suspendedPortal);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('suspended');
      expect(decision.suspendedReason).toBe('Scheduled maintenance until 10am');
    });

    it('handles password protected portals', () => {
      const passwordHash = PortalAccessService.hashPassword('pass123');
      const protectedPortal: Portal = {
        ...mockPortal,
        accessPolicy: {
          ...mockPortal.accessPolicy,
          visibility: 'password_protected',
          passwordProtected: true,
          passwordHash,
        },
      };

      // 1. No password provided
      const noPass = PortalAccessService.evaluateAccess(protectedPortal);
      expect(noPass.allowed).toBe(false);
      expect(noPass.reason).toBe('password_required');

      // 2. Wrong password provided
      const wrongPass = PortalAccessService.evaluateAccess(protectedPortal, {
        passwordAttempt: 'wrong',
      });
      expect(wrongPass.allowed).toBe(false);
      expect(wrongPass.reason).toBe('invalid_password');

      // 3. Correct password provided
      const correctPass = PortalAccessService.evaluateAccess(protectedPortal, {
        passwordAttempt: 'pass123',
      });
      expect(correctPass.allowed).toBe(true);
    });

    it('enforces authentication and email domain restrictions', () => {
      const authPortal: Portal = {
        ...mockPortal,
        accessPolicy: {
          ...mockPortal.accessPolicy,
          visibility: 'authenticated',
          requireAuth: true,
          allowedEmailDomains: ['school.edu'],
        },
      };

      // Not logged in
      const unauth = PortalAccessService.evaluateAccess(authPortal);
      expect(unauth.allowed).toBe(false);
      expect(unauth.reason).toBe('auth_required');

      // Logged in with wrong domain
      const wrongDomain = PortalAccessService.evaluateAccess(authPortal, {
        userId: 'u1',
        userEmail: 'john@gmail.com',
      });
      expect(wrongDomain.allowed).toBe(false);
      expect(wrongDomain.reason).toBe('domain_restricted');

      // Logged in with valid domain
      const validDomain = PortalAccessService.evaluateAccess(authPortal, {
        userId: 'u1',
        userEmail: 'headteacher@school.edu',
      });
      expect(validDomain.allowed).toBe(true);
    });
  });

  describe('Public Projection Serialization', () => {
    it('strips internal security hashes and sensitive fields', () => {
      const secretPortal: Portal = {
        ...mockPortal,
        accessPolicy: {
          ...mockPortal.accessPolicy,
          passwordProtected: true,
          passwordHash: 'secret_sha256_hash',
          ipWhitelist: ['192.168.1.1'],
        },
      };

      const projection = PortalAccessService.serializePublicPortal(secretPortal);
      expect(projection.id).toBe('portal-123');
      expect(projection.name).toBe('Test Academy');
      expect(projection.isPasswordProtected).toBe(true);
      expect((projection as any).passwordHash).toBeUndefined();
      expect((projection as any).ipWhitelist).toBeUndefined();
    });
  });
});
