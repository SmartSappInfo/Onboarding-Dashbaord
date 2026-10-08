// @vitest-environment node
/**
 * @fileOverview Comprehensive Test Suite for Bounded Delegation Engine (Phase 3 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 10, 16, 17, 22, 23, 40, 47, 66, 68.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentDelegationGrantSchema,
  CreateDelegationInputSchema,
  SubDelegationInputSchema,
} from '../../policy/delegation-types';
import { createDelegationService } from '../../policy/delegation-service';
import { createMemoryDelegationStore } from '../../policy/delegation-store';
import { evaluatePrincipalAuthority } from '../../capabilities/policy/principal-evaluator';

describe('Phase 3 Milestone 2: Delegation Types & Schemas', () => {
  it('validates a well-formed delegation grant', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1'],
      depth: 1,
      agentPersonaId: 'supervisor',
      delegatedScopes: ['crm:contacts:read', 'deals:pipeline:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(true);
  });

  it('rejects wildcard (*) in delegatedScopes schema', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1'],
      depth: 1,
      agentPersonaId: 'supervisor',
      delegatedScopes: ['*', 'crm:contacts:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(false);
  });

  it('rejects delegation depth exceeding maximum limit (3)', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1', 'agent_1', 'agent_2', 'agent_3'],
      depth: 4,
      agentPersonaId: 'lead_sdr',
      delegatedScopes: ['crm:contacts:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(false);
  });

  it('validates CreateDelegationInput and SubDelegationInput schemas', () => {
    const createInput = {
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      authorizingUserId: 'user_1',
      agentPersonaId: 'supervisor',
      requestedScopes: ['crm:contacts:read'],
      userEffectivePermissions: ['crm:contacts:read', 'deals:pipeline:read'],
      ttlSeconds: 3600,
    };
    expect(CreateDelegationInputSchema.safeParse(createInput).success).toBe(true);

    const subInput = {
      parentDelegationId: 'del_parent_1',
      childPersonaId: 'lead_sdr',
      requestedScopes: ['crm:contacts:read'],
      ttlSeconds: 1800,
    };
    expect(SubDelegationInputSchema.safeParse(subInput).success).toBe(true);
  });

  describe('DelegationStore (Memory Implementation - Rules 4, 8, 40)', () => {
    it('saves and retrieves a delegation grant', async () => {
      const { createMemoryDelegationStore } = await import('../../policy/delegation-store');
      const store = createMemoryDelegationStore();
      const grant = {
        id: 'del_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        delegationChain: ['user_1'],
        depth: 1,
        agentPersonaId: 'supervisor' as const,
        delegatedScopes: ['crm:contacts:read'],
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      await store.saveGrant(grant);
      const retrieved = await store.getGrant('del_1');
      expect(retrieved).toEqual(grant);

      // Status update
      await store.updateGrantStatus('del_1', 'revoked', {
        revokedBy: 'user_1',
        revocationReason: 'Manually revoked by admin',
      });
      const updated = await store.getGrant('del_1');
      expect(updated?.status).toBe('revoked');
      expect(updated?.revokedBy).toBe('user_1');
      expect(updated?.revocationReason).toBe('Manually revoked by admin');
    });

    it('filters grants by organization, workspace, user, and status', async () => {
      const { createMemoryDelegationStore } = await import('../../policy/delegation-store');
      const store = createMemoryDelegationStore();
      const now = new Date().toISOString();
      const expiry = new Date(Date.now() + 3600000).toISOString();

      await store.saveGrant({
        id: 'del_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        delegationChain: ['user_1'],
        depth: 1,
        agentPersonaId: 'supervisor',
        delegatedScopes: ['crm:contacts:read'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry,
      });

      await store.saveGrant({
        id: 'del_2',
        organizationId: 'org_1',
        workspaceId: 'ws_2',
        authorizingUserId: 'user_2',
        delegationChain: ['user_2'],
        depth: 1,
        agentPersonaId: 'lead_sdr',
        delegatedScopes: ['crm:contacts:read'],
        status: 'revoked',
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry,
      });

      const org1Active = await store.listGrants({ organizationId: 'org_1', status: 'active' });
      expect(org1Active).toHaveLength(1);
      expect(org1Active[0].id).toBe('del_1');

      const ws2 = await store.listGrants({ organizationId: 'org_1', workspaceId: 'ws_2' });
      expect(ws2).toHaveLength(1);
      expect(ws2[0].id).toBe('del_2');
    });

    it('cascades revocation to multi-hop child delegations down the chain', async () => {
      const store = createMemoryDelegationStore();
      const now = new Date().toISOString();
      const expiry = new Date(Date.now() + 3600000).toISOString();

      const root = {
        id: 'del_root',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        delegationChain: ['user_1'],
        depth: 1,
        agentPersonaId: 'supervisor' as const,
        delegatedScopes: ['crm:contacts:read'],
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry,
      };

      const child = {
        id: 'del_child',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        parentDelegationId: 'del_root',
        delegationChain: ['user_1', 'agent_supervisor'],
        depth: 2,
        agentPersonaId: 'lead_sdr' as const,
        delegatedScopes: ['crm:contacts:read'],
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry,
      };

      const grandchild = {
        id: 'del_grandchild',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        parentDelegationId: 'del_child',
        delegationChain: ['user_1', 'agent_supervisor', 'agent_sdr'],
        depth: 3,
        agentPersonaId: 'crm_researcher' as const,
        delegatedScopes: ['crm:contacts:read'],
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry,
      };

      await store.saveGrant(root);
      await store.saveGrant(child);
      await store.saveGrant(grandchild);

      // Revoking root should cascade to child and grandchild
      const count = await store.revokeChildDelegations('del_root', 'user_1', 'Root revoked by operator');
      expect(count).toBe(2);

      const childAfter = await store.getGrant('del_child');
      const grandchildAfter = await store.getGrant('del_grandchild');
      expect(childAfter?.status).toBe('revoked');
      expect(grandchildAfter?.status).toBe('revoked');
      expect(grandchildAfter?.revocationReason).toBe('Root revoked by operator');
    });
  });

  describe('DelegationService (Monotonic Scope Attenuation & Depth - Rules 8, 16, 17, 23)', () => {
    it('creates root delegation using pure scope intersection and strips wildcards and non-delegables', async () => {
      const store = createMemoryDelegationStore();
      const service = createDelegationService({ store });

      const grant = await service.createRootDelegation({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_admin',
        agentPersonaId: 'supervisor',
        // User has admin permissions, non-delegables, and wildcards
        userEffectivePermissions: [
          '*',
          'app:system_admin',
          'rbac:workforce.roles.edit',
          'rbac:operations.campuses.view',
          'rbac:operations.pipeline.view',
        ],
        // Requesting broad permissions including non-delegables and wildcard
        requestedScopes: [
          '*',
          'app:system_admin',
          'rbac:operations.campuses.view',
          'rbac:operations.pipeline.view',
          'unsupported:fake:perm',
        ],
      });

      expect(grant.depth).toBe(1);
      expect(grant.delegationChain).toEqual(['user_admin']);
      expect(grant.status).toBe('active');

      // Wildcard '*' must be stripped (Rule 16)
      expect(grant.delegatedScopes).not.toContain('*');
      // Non-delegables must be stripped (Rule 17)
      expect(grant.delegatedScopes).not.toContain('app:system_admin');
      expect(grant.delegatedScopes).not.toContain('rbac:workforce.roles.edit');
      // Non-persona permissions must not be granted
      expect(grant.delegatedScopes).not.toContain('unsupported:fake:perm');
      // Legitimate intersecting permissions must be granted
      expect(grant.delegatedScopes).toContain('rbac:operations.campuses.view');
      expect(grant.delegatedScopes).toContain('rbac:operations.pipeline.view');
    });

    it('creates sub-delegation with downward monotonic attenuation (Child <= Parent)', async () => {
      const store = createMemoryDelegationStore();
      const service = createDelegationService({ store });

      const parentGrant = await service.createRootDelegation({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        agentPersonaId: 'supervisor',
        userEffectivePermissions: ['rbac:operations.campuses.view', 'rbac:operations.tasks.view'],
        requestedScopes: ['rbac:operations.campuses.view', 'rbac:operations.tasks.view'],
      });

      const parentPrincipal = {
        actorType: 'agent' as const,
        userId: 'user_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        agentId: 'supervisor',
        delegationId: parentGrant.id,
        grantedScopes: parentGrant.delegatedScopes,
        effectiveRole: 'agent',
      };

      // Sub-delegation to Lead SDR
      // Lead SDR has 'rbac:operations.campuses.view', but NOT 'rbac:operations.tasks.view'
      const childGrant = await service.createSubDelegation(parentPrincipal, {
        parentDelegationId: parentGrant.id,
        childPersonaId: 'lead_sdr',
        requestedScopes: ['rbac:operations.campuses.view', 'rbac:operations.tasks.view'],
      });

      expect(childGrant.depth).toBe(2);
      expect(childGrant.parentDelegationId).toBe(parentGrant.id);
      expect(childGrant.delegationChain).toEqual(['user_1', 'supervisor']);
      expect(childGrant.delegatedScopes).toEqual(['rbac:operations.campuses.view']);
      expect(childGrant.delegatedScopes).not.toContain('rbac:operations.tasks.view');
    });

    it('rejects sub-delegation when exceeding maximum delegation depth of 3', async () => {
      const { createDelegationService } = await import('../../policy/delegation-service');
      const { createMemoryDelegationStore } = await import('../../policy/delegation-store');
      const store = createMemoryDelegationStore();
      const service = createDelegationService({ store });

      // Depth 1: Root
      const g1 = await service.createRootDelegation({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        agentPersonaId: 'supervisor',
        userEffectivePermissions: ['rbac:operations.campuses.view'],
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      // Depth 2: Sub-agent
      const p1 = {
        actorType: 'agent' as const,
        userId: 'user_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        agentId: 'supervisor',
        delegationId: g1.id,
        grantedScopes: g1.delegatedScopes,
        effectiveRole: 'agent',
      };
      const g2 = await service.createSubDelegation(p1, {
        parentDelegationId: g1.id,
        childPersonaId: 'lead_sdr',
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      // Depth 3: Sub-sub-agent
      const p2 = {
        actorType: 'agent' as const,
        userId: 'user_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        agentId: 'lead_sdr',
        delegationId: g2.id,
        grantedScopes: g2.delegatedScopes,
        effectiveRole: 'agent',
      };
      const g3 = await service.createSubDelegation(p2, {
        parentDelegationId: g2.id,
        childPersonaId: 'crm_researcher',
        requestedScopes: ['rbac:operations.campuses.view'],
      });
      expect(g3.depth).toBe(3);

      // Depth 4: Attempting to delegate beyond limit 3 must fail closed
      const p3 = {
        actorType: 'agent' as const,
        userId: 'user_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        agentId: 'crm_researcher',
        delegationId: g3.id,
        grantedScopes: g3.delegatedScopes,
        effectiveRole: 'agent',
      };
      await expect(
        service.createSubDelegation(p3, {
          parentDelegationId: g3.id,
          childPersonaId: 'portal_guide',
          requestedScopes: ['rbac:operations.campuses.view'],
        })
      ).rejects.toThrow(/maximum permitted delegation depth is 3/);
    });

    it('validates delegation status and enforces tenant isolation (Anti-IDOR)', async () => {
      const store = createMemoryDelegationStore();
      const service = createDelegationService({ store });

      const grant = await service.createRootDelegation({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        authorizingUserId: 'user_1',
        agentPersonaId: 'supervisor',
        userEffectivePermissions: ['rbac:operations.campuses.view'],
        requestedScopes: ['rbac:operations.campuses.view'],
      });

      // Matching tenant scope
      const valid = await service.validateDelegation(grant.id, {
        organizationId: 'org_1',
        workspaceId: 'ws_1',
      });
      expect(valid.valid).toBe(true);

      // Cross-tenant mismatch (Anti-IDOR)
      const mismatched = await service.validateDelegation(grant.id, {
        organizationId: 'org_attacker',
        workspaceId: 'ws_1',
      });
      expect(mismatched.valid).toBe(false);
      if (!mismatched.valid) {
        expect(mismatched.code).toBe('TENANT_MISMATCH');
      }

      // Revocation
      await service.revokeDelegation(grant.id, 'admin_user', 'Security investigation');
      const revoked = await service.validateDelegation(grant.id, {
        organizationId: 'org_1',
        workspaceId: 'ws_1',
      });
      expect(revoked.valid).toBe(false);
      if (!revoked.valid) {
        expect(revoked.code).toBe('DELEGATION_REVOKED');
      }
    });
  });

  describe('Policy Evaluator Integration (VerifiedApproval Bypass & Domain Guards - Rules 12, 16, 22)', () => {
    it('bypasses autonomous risk ceiling when a valid human approval is verified', async () => {
      const tenant = { organizationId: 'org_1', workspaceId: 'ws_1' };

      const agentPrincipal = {
        actorType: 'agent' as const,
        userId: 'user_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        agentId: 'lead_sdr', // Max autonomous ceiling: L2_STATE_MUTATION
        grantedScopes: ['rbac:social.campaigns.view', 'rbac:social.campaigns.send'],
        toolInvocationId: 'tool_inv_1',
        effectiveRole: 'agent',
      };

      // L3 Outbound communication capability
      const l3Capability = {
        id: 'campaigns.send_outbound',
        version: '1.0.0',
        domain: 'communication_messaging' as const, // Allowed domain for lead_sdr
        permissions: ['rbac:social.campaigns.send'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: {
          level: 'L3_EXTERNAL_COMMUNICATION_FINANCE' as const,
          destructive: false,
          idempotent: false,
          openWorld: true,
          requiresHumanApproval: true,
          nonDelegable: false,
        },
      };

      // 1. Without approval: Denied (both PERSONA_DISALLOWED because L3 > L2, and APPROVAL_REQUIRED)
      const unapprovedResult = evaluatePrincipalAuthority(agentPrincipal, l3Capability, tenant);
      expect(unapprovedResult.allowed).toBe(false);
      expect(unapprovedResult.violationCodes).toContain('PERSONA_DISALLOWED');
      expect(unapprovedResult.violationCodes).toContain('APPROVAL_REQUIRED');

      // 2. With verified human approval: Autonomous ceiling is bypassed; allowed!
      const validApproval = {
        approvalId: 'appr_1',
        approvedBy: 'human_operator_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        capabilityId: 'campaigns.send_outbound',
        capabilityVersion: '1.0.0',
        toolInvocationId: 'tool_inv_1',
        payloadHash: 'hash_abc123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        verifiedAt: new Date().toISOString(),
      };

      const approvedResult = evaluatePrincipalAuthority(agentPrincipal, l3Capability, tenant, {
        verifiedApproval: validApproval,
        payloadHash: 'hash_abc123',
      });
      expect(approvedResult.allowed).toBe(true);
      expect(approvedResult.violations).toHaveLength(0);

      // 3. Even with approval, domain boundaries remain strictly enforced (e.g. finance_subscriptions)
      const financeCapability = {
        ...l3Capability,
        id: 'finance.charge_card',
        domain: 'finance_subscriptions' as const, // Disallowed domain for lead_sdr
        permissions: ['rbac:social.campaigns.send'],
      };

      const outOfDomainResult = evaluatePrincipalAuthority(agentPrincipal, financeCapability, tenant, {
        verifiedApproval: {
          ...validApproval,
          capabilityId: 'finance.charge_card',
        },
        payloadHash: 'hash_abc123',
      });
      expect(outOfDomainResult.allowed).toBe(false);
      expect(outOfDomainResult.violationCodes).toContain('PERSONA_DISALLOWED');
      expect(outOfDomainResult.reason).toMatch(/Domain 'finance_subscriptions' is not permitted/);
    });
  });
});
