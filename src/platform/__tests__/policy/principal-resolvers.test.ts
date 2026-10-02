// @vitest-environment node
/**
 * @fileOverview Unit & Parity Tests for Principal Resolvers (PR-6 / Workstream 1.3)
 *
 * Validates Rule 16 (Least Privilege & Wildcard Ban for Agents), Rule 17 (Non-Delegable Actions),
 * Rule 47 & 48 (Anti-Spoofing & Explicit Workspace Scope), and RBAC Parity with QA Role Templates.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  resolvePrincipalFromSession,
  extractHierarchicalScopes,
} from '@/platform/capabilities/policy/session-principal-resolver';
import { resolvePrincipalFromPortalToken } from '@/platform/capabilities/policy/portal-principal-resolver';
import { resolvePrincipalForAgent } from '@/platform/capabilities/policy/agent-principal-resolver';
import {
  resolveServicePrincipal,
  SERVICE_NAMES,
  SERVICE_SCOPES,
} from '@/platform/capabilities/policy/service-principals';
import { resolvePrincipalFromMcpKey } from '@/platform/capabilities/policy/mcp-principal-resolver';
import { evaluatePrincipalAuthority } from '@/platform/capabilities/policy/principal-evaluator';
import {
  CANONICAL_ROLE_BLUEPRINTS,
} from '@/lib/role-blueprint-presets';
import {
  normalizePermissionsSchema,
  evaluatePermission,
} from '@/lib/permissions-engine';
import type { AgentPrincipal, CapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import type { UserProfile, PermissionsSchema } from '@/lib/types';
import type { Portal } from '@/lib/types/portal';
import type { McpApiKey } from '@/lib/mcp/types';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { PortalMemberContext } from '@/lib/auth/require-portal-access';

function createDummyCapability(overrides: Partial<CapabilityDefinition<unknown, unknown>> = {}): CapabilityDefinition<unknown, unknown> {
  return {
    id: 'test.operation',
    version: '1.0.0',
    name: 'Test Operation',
    description: 'Test capability',
    domain: 'platform_integrations',
    operation: 'execute',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    permissions: ['app:contacts_view'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L0_READ',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    handler: async () => ({
      success: true,
      data: {},
      executionId: 'exec_test',
      emittedEvents: [],
      durationMs: 1,
    }),
    ...overrides,
  };
}

describe('PR-6: Principal Resolvers & Parity Test Suite', () => {
  describe('Session Principal Resolver (session-principal-resolver.ts)', () => {
    it('resolves system_admin user with wildcard scope and system_admin role', async () => {
      const mockProfile: UserProfile = {
        id: 'user_admin_1',
        name: 'Super Admin',
        email: 'admin@smartsapp.com',
        displayName: 'Super Admin',
        organizationId: 'org_main',
        workspaceIds: ['ws_main'],
        isAuthorized: true,
        permissions: ['system_admin'],
        role: 'system_admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockAuth: AuthContext = {
        uid: 'user_admin_1',
        profile: mockProfile,
        isSystemAdmin: true,
      };

      const principal = await resolvePrincipalFromSession('ws_main', { authContext: mockAuth });

      expect(principal.actorType).toBe('user');
      expect(principal.userId).toBe('user_admin_1');
      expect(principal.organizationId).toBe('org_main');
      expect(principal.workspaceId).toBe('ws_main');
      expect(principal.effectiveRole).toBe('system_admin');
      expect(principal.grantedScopes).toContain('*');
      expect(principal.grantedScopes).toContain('app:system_admin');
    });

    it('resolves standard user with flat and hierarchical scopes', async () => {
      const mockSchema: PermissionsSchema = {
        operations: {
          enabled: true,
          features: {
            campuses: { view: true, create: true },
            pipeline: { view: true },
          },
        },
        finance: { enabled: false, features: {} },
        studios: { enabled: false, features: {} },
        social: { enabled: false, features: {} },
        workforce: { enabled: false, features: {} },
        management: { enabled: false, features: {} },
      };

      const mockProfile: UserProfile = {
        id: 'user_rep_1',
        name: 'Sales Rep',
        email: 'rep@smartsapp.com',
        displayName: 'Sales Rep',
        organizationId: 'org_main',
        workspaceIds: ['ws_sales'],
        isAuthorized: true,
        permissions: ['prospects_view'],
        permissionsSchema: mockSchema,
        role: 'sales_rep',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockAuth: AuthContext = {
        uid: 'user_rep_1',
        profile: mockProfile,
        isSystemAdmin: false,
      };

      const extractedScopes = extractHierarchicalScopes(mockSchema);
      expect(extractedScopes).toContain('rbac:operations.campuses.view');
      expect(extractedScopes).toContain('rbac:operations.campuses.create');
      expect(extractedScopes).toContain('rbac:operations.pipeline.view');

      const principal = await resolvePrincipalFromSession('ws_sales', { authContext: mockAuth });

      expect(principal.actorType).toBe('user');
      expect(principal.grantedScopes).toContain('prospects_view');
      expect(principal.grantedScopes).toContain('app:prospects_view');
      expect(principal.grantedScopes).toContain('rbac:operations.campuses.view');
      expect(principal.grantedScopes).toContain('rbac:operations.campuses.create');
      expect(principal.grantedScopes).toContain('rbac:operations.pipeline.view');
      // Must not contain wildcard '*' for ordinary users
      expect(principal.grantedScopes).not.toContain('*');
    });
  });

  describe('Portal Principal Resolver (portal-principal-resolver.ts)', () => {
    const mockPortal: Portal = {
      id: 'portal_101',
      organizationId: 'org_academy',
      workspaceIds: ['ws_academy'],
      name: 'SmartSapp Academy',
      slug: 'academy',
      primaryMode: 'academy',
      enabledModes: ['academy'],
      status: 'published',
      visibility: 'authenticated',
      branding: { brandName: 'Academy' },
      theme: {
        colorMode: 'user_choice',
        colors: {
          primary: '#000',
          secondary: '#111',
          accent: '#222',
          background: '#fff',
          surface: '#eee',
          text: '#000',
          mutedText: '#666',
          border: '#ccc',
        },
        typography: { headingFont: 'Inter', bodyFont: 'Inter', baseSize: 'md' },
        ui: { borderRadius: 'md', buttonStyle: 'flat' },
      },
      navigation: { headerItems: [], headerActions: { showLoginButton: true, showSearch: false }, sidebarItems: [], footerColumns: [], socialLinks: [] },
      accessPolicy: { visibility: 'authenticated', requireAuth: true, allowedRoles: ['member'], passwordProtected: false },
      features: {
        enableCourses: true,
        enableCommunity: true,
        enableBlog: false,
        enableDocs: false,
        enableResources: false,
        enableEvents: false,
        enableGamification: false,
        enableAiTutor: false,
        enableAffiliates: false,
      },
      seo: {},
      createdBy: 'user_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('resolves active portal member with scoped learner permissions', async () => {
      const mockMemberCtx: PortalMemberContext = {
        uid: 'learner_1',
        email: 'learner@example.com',
        isPortalStaff: false,
        membership: {
          id: 'mem_1',
          organizationId: 'org_academy',
          portalId: 'portal_101',
          workspaceIds: ['ws_academy'],
          userId: 'learner_1',
          email: 'learner@example.com',
          displayName: 'Learner One',
          role: 'member',
          status: 'active',
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          points: 0,
          streakDays: 0,
          badges: [],
          completedLessonIds: [],
          enrolledCourseIds: [],
          bookmarkedContentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const principal = await resolvePrincipalFromPortalToken('valid_token', 'portal_101', {
        memberContext: mockMemberCtx,
        portal: mockPortal,
      });

      expect(principal.actorType).toBe('user');
      expect(principal.userId).toBe('learner_1');
      expect(principal.organizationId).toBe('org_academy');
      expect(principal.workspaceId).toBe('ws_academy');
      expect(principal.effectiveRole).toBe('member');
      expect(principal.grantedScopes).toContain('app:portal_view');
      expect(principal.grantedScopes).toContain('portal:member:view');
      expect(principal.grantedScopes).toContain('portal:member:participate');
      expect(principal.grantedScopes).toContain('portal:courses:view');
      expect(principal.grantedScopes).toContain('portal:community:view');
      expect(principal.grantedScopes).toContain('portal:membership:active');
      expect(principal.grantedScopes).not.toContain('app:portal_manage');
    });

    it('resolves portal staff with management privileges', async () => {
      const mockStaffCtx: PortalMemberContext = {
        uid: 'staff_1',
        email: 'staff@smartsapp.com',
        isPortalStaff: true,
        membership: null,
      };

      const principal = await resolvePrincipalFromPortalToken('valid_staff_token', 'portal_101', {
        memberContext: mockStaffCtx,
        portal: mockPortal,
      });

      expect(principal.effectiveRole).toBe('portal_staff');
      expect(principal.grantedScopes).toContain('app:portal_manage');
      expect(principal.grantedScopes).toContain('portal:courses:manage');
      expect(principal.grantedScopes).toContain('portal:community:manage');
    });
  });

  describe('Agent Delegation Principal Resolver (agent-principal-resolver.ts)', () => {
    it('strips wildcard * scope and non-delegable permissions from agent delegation (Rules 16 & 17)', () => {
      const userPrincipal: AgentPrincipal = {
        actorType: 'user',
        userId: 'admin_user',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        grantedScopes: [
          '*', // Wildcard (Rule 16)
          'app:system_admin', // Non-delegable (Rule 17)
          'admin.grant_permission', // Non-delegable (Rule 17)
          'organization.delete', // Non-delegable (Rule 17)
          'app:contacts_view', // Delegable
          'app:deals_view', // Delegable
        ],
        effectiveRole: 'admin',
      };

      const agentPrincipal = resolvePrincipalForAgent(userPrincipal, 'agent_crm_assistant', {
        agentVersion: '2.1.0',
        delegationId: 'del_123',
      });

      expect(agentPrincipal.actorType).toBe('agent');
      expect(agentPrincipal.agentId).toBe('agent_crm_assistant');
      expect(agentPrincipal.agentVersion).toBe('2.1.0');
      expect(agentPrincipal.delegationId).toBe('del_123');

      // Assert Rule 16: Wildcard MUST be stripped
      expect(agentPrincipal.grantedScopes).not.toContain('*');

      // Assert Rule 17: Non-delegables MUST be stripped
      expect(agentPrincipal.grantedScopes).not.toContain('app:system_admin');
      expect(agentPrincipal.grantedScopes).not.toContain('admin.grant_permission');
      expect(agentPrincipal.grantedScopes).not.toContain('organization.delete');

      // Delegable scopes preserved
      expect(agentPrincipal.grantedScopes).toEqual(['app:contacts_view', 'app:deals_view']);
    });

    it('intersects user scopes with explicit agentAllowlist (Rule 16 Least Privilege)', () => {
      const userPrincipal: AgentPrincipal = {
        actorType: 'user',
        userId: 'lead_user',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        grantedScopes: ['app:contacts_view', 'app:contacts_manage', 'app:deals_view'],
        effectiveRole: 'manager',
      };

      const agentPrincipal = resolvePrincipalForAgent(userPrincipal, 'agent_readonly', {
        agentAllowlist: ['app:contacts_view', 'app:tasks_view'],
      });

      // User has contacts_view and deals_view; allowlist has contacts_view and tasks_view.
      // Intersection = ['app:contacts_view']
      expect(agentPrincipal.grantedScopes).toEqual(['app:contacts_view']);
    });
  });

  describe('Service Principals (service-principals.ts)', () => {
    it('resolves valid service principals with bounded allowlists', () => {
      for (const service of SERVICE_NAMES) {
        const principal = resolveServicePrincipal(service, 'ws_prod', 'org_prod');

        expect(principal.actorType).toBe('agent');
        expect(principal.agentId).toBe(`service:${service}`);
        expect(principal.workspaceId).toBe('ws_prod');
        expect(principal.organizationId).toBe('org_prod');

        // Bounded allowlist
        expect(principal.grantedScopes).toEqual(SERVICE_SCOPES[service]);
        // Zero wildcards
        expect(principal.grantedScopes).not.toContain('*');
      }
    });

    it('rejects unrecognized service names', () => {
      expect(() =>
        resolveServicePrincipal('unrecognized_service' as unknown as typeof SERVICE_NAMES[number], 'ws_1', 'org_1')
      ).toThrow(/Unrecognized service name/);
    });
  });

  describe('MCP Principal Resolver (mcp-principal-resolver.ts / Anti-Spoofing Finding N4)', () => {
    const validKey: McpApiKey = {
      id: 'key_123',
      keyPrefix: 'sk_mcp_...abcd',
      keyHash: 'hash_abc',
      workspaceId: 'ws_verified',
      organizationId: 'org_verified',
      name: 'Cursor IDE',
      role: 'agent',
      allowedCategories: ['crm', 'task'],
      rateLimitPerMinute: 60,
      createdAt: new Date().toISOString(),
      revoked: false,
    };

    it('binds organizationId and workspaceId strictly from verified key document', () => {
      const principal = resolvePrincipalFromMcpKey(validKey, {
        toolInvocationId: 'inv_99',
        runId: 'run_42',
      });

      expect(principal.actorType).toBe('agent');
      expect(principal.organizationId).toBe('org_verified');
      expect(principal.workspaceId).toBe('ws_verified');
      expect(principal.toolInvocationId).toBe('inv_99');
      expect(principal.runId).toBe('run_42');

      // Scopes from crm and task
      expect(principal.grantedScopes).toContain('app:contacts_view');
      expect(principal.grantedScopes).toContain('app:tasks_view');
      expect(principal.grantedScopes).not.toContain('app:deals_view');
    });

    it('rejects revoked keys', () => {
      const revokedKey: McpApiKey = {
        ...validKey,
        revoked: true,
      };
      expect(() => resolvePrincipalFromMcpKey(revokedKey)).toThrow(/revoked/);
    });

    it('rejects expired keys', () => {
      const expiredKey: McpApiKey = {
        ...validKey,
        expiresAt: new Date(Date.now() - 10000).toISOString(),
      };
      expect(() => resolvePrincipalFromMcpKey(expiredKey)).toThrow(/expired/);
    });
  });

  describe('Parity Verification with Canonical Role Blueprints (role-templates-qa)', () => {
    it('demonstrates RBAC parity across canonical industry blueprints', async () => {
      // Test 1: builtin-super-admin
      const superAdminBlueprint = CANONICAL_ROLE_BLUEPRINTS.find((b) => b.id === 'builtin-super-admin')!;
      expect(superAdminBlueprint).toBeDefined();

      const superAdminProfile: UserProfile = {
        id: 'user_super_admin',
        name: 'Super Admin',
        email: 'super@smartsapp.com',
        displayName: 'Super Admin',
        organizationId: 'org_corp',
        workspaceIds: ['ws_corp'],
        isAuthorized: true,
        permissionsSchema: normalizePermissionsSchema(superAdminBlueprint.content),
        permissions: ['system_admin'],
        role: 'super_admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const superPrincipal = await resolvePrincipalFromSession('ws_corp', {
        authContext: { uid: 'user_super_admin', profile: superAdminProfile, isSystemAdmin: true },
      });

      const superCap = createDummyCapability({ permissions: ['rbac:operations.campuses.create'] });
      const superEval = evaluatePrincipalAuthority(superPrincipal, superCap, {
        organizationId: 'org_corp',
        workspaceId: 'ws_corp',
      });
      expect(superEval.allowed).toBe(true);

      // Test 2: builtin-operations-lead
      const opsLeadBlueprint = CANONICAL_ROLE_BLUEPRINTS.find((b) => b.id === 'builtin-operations-lead')!;
      expect(opsLeadBlueprint).toBeDefined();
      const opsLeadSchema = normalizePermissionsSchema(opsLeadBlueprint.content);

      // Verify evaluatePermission baseline
      expect(evaluatePermission(opsLeadSchema, 'operations', 'campuses', 'view')).toBe(true);
      expect(evaluatePermission(opsLeadSchema, 'management', 'users', 'delete')).toBe(false);

      const opsProfile: UserProfile = {
        id: 'user_ops_lead',
        name: 'Ops Lead',
        email: 'ops@smartsapp.com',
        displayName: 'Ops Lead',
        organizationId: 'org_corp',
        workspaceIds: ['ws_corp'],
        isAuthorized: true,
        permissions: ['schools_view'],
        permissionsSchema: opsLeadSchema,
        role: 'operations_lead',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const opsPrincipal = await resolvePrincipalFromSession('ws_corp', {
        authContext: { uid: 'user_ops_lead', profile: opsProfile, isSystemAdmin: false },
      });

      // Allowed capability
      const allowedCap = createDummyCapability({ permissions: ['rbac:operations.campuses.view'] });
      const allowedEval = evaluatePrincipalAuthority(opsPrincipal, allowedCap, {
        organizationId: 'org_corp',
        workspaceId: 'ws_corp',
      });
      expect(allowedEval.allowed).toBe(true);

      // Denied capability (finance/management deletion)
      const deniedCap = createDummyCapability({ permissions: ['rbac:management.users.delete'] });
      const deniedEval = evaluatePrincipalAuthority(opsPrincipal, deniedCap, {
        organizationId: 'org_corp',
        workspaceId: 'ws_corp',
      });
      expect(deniedEval.allowed).toBe(false);
      expect(deniedEval.violationCodes).toContain('INSUFFICIENT_SCOPE');
    });
  });
});
