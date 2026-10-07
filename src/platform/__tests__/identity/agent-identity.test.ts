// @vitest-environment node
/**
 * @fileOverview Unit & Security Test Suite for Agent Identity, Personas & Ephemeral Tokens (Phase 3 Milestone 1)
 *
 * Implements Rules 1, 4, 8, 10, 12, 13, 16, 23, 66, 68.
 * Validates persona contracts, Central Persona Registry, HMAC-SHA256 session token minting/verification,
 * signature tampering defense, constant-time verification, budget ceilings, and gateway authority evaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  globalAgentPersonaRegistry,
  createAgentPersonaRegistry,
  BUILT_IN_AGENT_PERSONAS,
} from '../../identity/agent-registry';
import {
  issueAgentSession,
  verifyAgentSessionToken,
  InvalidAgentSessionError,
} from '../../identity/agent-token-service';
import { evaluatePrincipalAuthority } from '../../capabilities/policy/principal-evaluator';
import type { CapabilityPolicyTarget, TargetScope } from '../../capabilities/policy/principal-evaluator';
import type { AgentPersonaDefinition } from '../../identity/agent-persona-types';

describe('Phase 3 Milestone 1: Agent Identity, Persona Profiles & Ephemeral Session Tokens', () => {
  beforeEach(() => {
    globalAgentPersonaRegistry.resetForTests();
  });

  describe('Agent Persona Registry (SSOT - Rules 1, 11, 12)', () => {
    it('pre-registers all canonical built-in personas with valid SemVer and budgets', () => {
      const personas = globalAgentPersonaRegistry.listPersonas();
      // 6 original Phase 3 personas + 5 Phase 9 CRM personas + 4 Phase 10 sales personas + 2 Phase 11 personas
      expect(personas.length).toBe(17); // Phase 11: + meeting_analyst, + knowledge_agent (Phase 11 Master Plan line 274)

      const personaIds = personas.map((p) => p.id);
      expect(personaIds).toContain('crm_researcher');
      expect(personaIds).toContain('lead_sdr');
      expect(personaIds).toContain('deal_coach');
      expect(personaIds).toContain('portal_guide');
      expect(personaIds).toContain('meeting_prep');
      expect(personaIds).toContain('supervisor');

      for (const p of personas) {
        expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(p.allowedDomains.length).toBeGreaterThan(0);
        expect(p.allowedPermissions.length).toBeGreaterThan(0);
        expect(p.budgets.maxTokens).toBeGreaterThanOrEqual(1000);
        expect(p.budgets.maxToolCalls).toBeGreaterThanOrEqual(1);
        expect(p.budgets.maxDurationMs).toBeGreaterThanOrEqual(1000);
      }
    });

    it('resolves legacy CompanyBrain 2.0 specialist aliases cleanly', () => {
      expect(globalAgentPersonaRegistry.resolvePersonaId('knowledge_specialist')).toBe('crm_researcher');
      expect(globalAgentPersonaRegistry.resolvePersonaId('revenue_specialist')).toBe('deal_coach');
      expect(globalAgentPersonaRegistry.resolvePersonaId('sdr_specialist')).toBe('lead_sdr');
      expect(globalAgentPersonaRegistry.resolvePersonaId('meeting_specialist')).toBe('meeting_prep');
      expect(globalAgentPersonaRegistry.resolvePersonaId('operations_specialist')).toBe('deal_coach');
      expect(globalAgentPersonaRegistry.resolvePersonaId('governance_specialist')).toBe('supervisor');

      // Direct lookup via alias
      const sdr = globalAgentPersonaRegistry.getPersona('sdr_specialist');
      expect(sdr?.id).toBe('lead_sdr');
      expect(sdr?.name).toBe('Autonomous Lead SDR Agent');
    });

    it('creates an isolated registry without polluting the global instance', () => {
      const isolated = createAgentPersonaRegistry();
      expect(isolated.listPersonas()).toHaveLength(17);
      expect(isolated.hasPersona('crm_researcher')).toBe(true);
    });

    it('validates persona capability domain boundaries and risk ceilings', () => {
      // 1. CRM Researcher (Allowed: crm_contacts, L0_READ)
      const allowedCrmCap: Pick<CapabilityPolicyTarget, 'domain' | 'risk'> = {
        domain: 'crm_contacts',
        risk: {
          level: 'L0_READ',
          destructive: false,
          idempotent: true,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
      };
      expect(globalAgentPersonaRegistry.validatePersonaCapability('crm_researcher', allowedCrmCap).allowed).toBe(true);

      // Disallowed domain for CRM Researcher (e.g. finance_subscriptions)
      const financeCap: Pick<CapabilityPolicyTarget, 'domain' | 'risk'> = {
        domain: 'finance_subscriptions',
        risk: {
          level: 'L0_READ',
          destructive: false,
          idempotent: true,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
      };
      const domainResult = globalAgentPersonaRegistry.validatePersonaCapability('crm_researcher', financeCap);
      expect(domainResult.allowed).toBe(false);
      expect(domainResult.reason).toMatch(/Domain 'finance_subscriptions' is not permitted/);

      // Disallowed risk for CRM Researcher (L2_STATE_MUTATION exceeds L0_READ ceiling)
      const mutatingCrmCap: Pick<CapabilityPolicyTarget, 'domain' | 'risk'> = {
        domain: 'crm_contacts',
        risk: {
          level: 'L2_STATE_MUTATION',
          destructive: false,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
      };
      const riskResult = globalAgentPersonaRegistry.validatePersonaCapability('crm_researcher', mutatingCrmCap);
      expect(riskResult.allowed).toBe(false);
      expect(riskResult.reason).toMatch(/exceeds persona 'CRM Researcher Agent' autonomous ceiling/);
    });

    it('rejects duplicate persona registration without allowOverride', () => {
      const custom: AgentPersonaDefinition = {
        ...BUILT_IN_AGENT_PERSONAS[0],
        name: 'Duplicate Persona',
      };
      expect(() => globalAgentPersonaRegistry.registerPersona(custom)).toThrow(/already registered/);
      expect(() => globalAgentPersonaRegistry.registerPersona(custom, { allowOverride: true })).not.toThrow();
    });
  });

  describe('Ephemeral Agent Session Token Service (Rules 4, 8, 13, 16)', () => {
    const validTenant = {
      organizationId: 'org_test_123',
      workspaceId: 'ws_test_456',
      userId: 'user_operator_789',
    };

    it('mints a signed session token and canonical AgentPrincipal', () => {
      const session = issueAgentSession({
        personaId: 'lead_sdr',
        ...validTenant,
        requestedScopes: ['rbac:operations.campuses.view', 'rbac:operations.campuses.edit'],
      });

      expect(session.token).toBeDefined();
      expect(session.token.split('.').length).toBe(2);

      expect(session.principal.actorType).toBe('agent');
      expect(session.principal.agentId).toBe('lead_sdr');
      expect(session.principal.organizationId).toBe(validTenant.organizationId);
      expect(session.principal.workspaceId).toBe(validTenant.workspaceId);
      expect(session.principal.userId).toBe(validTenant.userId);
      expect(session.principal.grantedScopes).toEqual([
        'rbac:operations.campuses.view',
        'rbac:operations.campuses.edit',
      ]);
    });

    it('verifies a valid token and returns the authentic AgentPrincipal', () => {
      const session = issueAgentSession({
        personaId: 'deal_coach',
        ...validTenant,
        toolInvocationId: 'inv_step_001',
      });

      const verified = verifyAgentSessionToken(session.token);
      expect(verified.actorType).toBe('agent');
      expect(verified.agentId).toBe('deal_coach');
      expect(verified.agentVersion).toBe('1.0.0');
      expect(verified.toolInvocationId).toBe('inv_step_001');
      expect(verified.organizationId).toBe(validTenant.organizationId);
      expect(verified.workspaceId).toBe(validTenant.workspaceId);
      expect(verified.userId).toBe(validTenant.userId);
    });

    it('detects signature tampering and fails closed with INVALID_SIGNATURE', () => {
      const session = issueAgentSession({
        personaId: 'portal_guide',
        ...validTenant,
      });

      const [claims, signature] = session.token.split('.');
      const tamperedSignature = signature.slice(0, -4) + 'abcd';
      const tamperedToken = `${claims}.${tamperedSignature}`;

      expect(() => verifyAgentSessionToken(tamperedToken)).toThrow(InvalidAgentSessionError);
      try {
        verifyAgentSessionToken(tamperedToken);
      } catch (err) {
        expect((err as InvalidAgentSessionError).code).toBe('INVALID_SIGNATURE');
      }
    });

    it('detects payload tampering and fails closed with INVALID_SIGNATURE', () => {
      const session = issueAgentSession({
        personaId: 'crm_researcher',
        ...validTenant,
      });

      const [claims, signature] = session.token.split('.');
      // Tamper with payload by modifying base64 string
      const tamperedClaims = claims.slice(0, -4) + 'AAAA';
      const tamperedToken = `${tamperedClaims}.${signature}`;

      expect(() => verifyAgentSessionToken(tamperedToken)).toThrow(InvalidAgentSessionError);
    });

    it('rejects expired session tokens with EXPIRED_SESSION', () => {
      const session = issueAgentSession({
        personaId: 'crm_researcher',
        ...validTenant,
        ttlSeconds: 60, // 60s
      });

      // Verify at t = issued + 120s
      const futureMs = Date.now() + 120000;
      expect(() => verifyAgentSessionToken(session.token, { nowMs: futureMs })).toThrow(
        InvalidAgentSessionError
      );
      try {
        verifyAgentSessionToken(session.token, { nowMs: futureMs });
      } catch (err) {
        expect((err as InvalidAgentSessionError).code).toBe('EXPIRED_SESSION');
      }
    });

    it('strictly forbids wildcard (*) permissions for automated agents (Rule 16)', () => {
      expect(() =>
        issueAgentSession({
          personaId: 'supervisor',
          ...validTenant,
          requestedScopes: ['*'],
        })
      ).toThrow(InvalidAgentSessionError);

      try {
        issueAgentSession({
          personaId: 'supervisor',
          ...validTenant,
          requestedScopes: ['*'],
        });
      } catch (err) {
        expect((err as InvalidAgentSessionError).code).toBe('WILDCARD_SCOPE_FORBIDDEN');
      }
    });

    it('fails closed when tenant scope is missing (Rule 4 Anti-IDOR)', () => {
      expect(() =>
        issueAgentSession({
          personaId: 'crm_researcher',
          organizationId: '',
          workspaceId: 'ws_1',
          userId: 'user_1',
        })
      ).toThrow(/organizationId/);

      expect(() =>
        issueAgentSession({
          personaId: 'crm_researcher',
          organizationId: 'org_1',
          workspaceId: '',
          userId: 'user_1',
        })
      ).toThrow(/workspaceId/);
    });
  });

  describe('Gateway Integration & Principal Evaluator (Rules 12, 16, 69)', () => {
    const tenant: TargetScope = {
      organizationId: 'org_main',
      workspaceId: 'ws_main',
    };

    it('allows an authentic agent principal within persona domain and risk ceiling', () => {
      const session = issueAgentSession({
        personaId: 'crm_researcher',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        userId: 'user_lead_1',
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      const targetCapability: CapabilityPolicyTarget = {
        id: 'crm.contact.get',
        version: '1.0.0',
        domain: 'crm_contacts',
        permissions: ['rbac:operations.campuses.view'],
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
      };

      const result = evaluatePrincipalAuthority(session.principal, targetCapability, tenant);
      expect(result.allowed).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('denies an agent attempting a capability outside its persona domain', () => {
      const session = issueAgentSession({
        personaId: 'crm_researcher',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        userId: 'user_lead_1',
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      // Capability in deals_revenue is forbidden for crm_researcher
      const outOfDomainCapability: CapabilityPolicyTarget = {
        id: 'deals.pipeline.view',
        version: '1.0.0',
        domain: 'deals_revenue',
        permissions: ['rbac:operations.campuses.view'],
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
      };

      const result = evaluatePrincipalAuthority(session.principal, outOfDomainCapability, tenant);
      expect(result.allowed).toBe(false);
      expect(result.violationCodes).toContain('PERSONA_DISALLOWED');
      expect(result.violations.join('; ')).toMatch(/Domain 'deals_revenue' is not permitted/);
    });

    it('denies an agent attempting a capability exceeding its autonomous risk ceiling', () => {
      const session = issueAgentSession({
        personaId: 'crm_researcher', // Ceiling is L0_READ
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        userId: 'user_lead_1',
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      const mutatingCapability: CapabilityPolicyTarget = {
        id: 'crm.contact.create',
        version: '1.0.0',
        domain: 'crm_contacts',
        permissions: ['rbac:operations.campuses.view'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: {
          level: 'L2_STATE_MUTATION',
          destructive: false,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
      };

      const result = evaluatePrincipalAuthority(session.principal, mutatingCapability, tenant);
      expect(result.allowed).toBe(false);
      expect(result.violationCodes).toContain('PERSONA_DISALLOWED');
      expect(result.violations.join('; ')).toMatch(/exceeds persona 'CRM Researcher Agent' autonomous ceiling/);
    });

    it('strictly enforces multi-tenant boundary checks against agent principals (Rule 4)', () => {
      const session = issueAgentSession({
        personaId: 'lead_sdr',
        organizationId: 'org_alpha',
        workspaceId: 'ws_alpha',
        userId: 'user_1',
      });

      const targetOtherTenant: TargetScope = {
        organizationId: 'org_beta',
        workspaceId: 'ws_beta',
      };

      const cap: CapabilityPolicyTarget = {
        id: 'crm.contact.view',
        version: '1.0.0',
        domain: 'crm_contacts',
        permissions: ['rbac:operations.campuses.view'],
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
      };

      const result = evaluatePrincipalAuthority(session.principal, cap, targetOtherTenant);
      expect(result.allowed).toBe(false);
      expect(result.violationCodes).toContain('TENANT_ISOLATION');
      expect(result.violationCodes).toContain('WORKSPACE_ISOLATION');
    });
  });
});
