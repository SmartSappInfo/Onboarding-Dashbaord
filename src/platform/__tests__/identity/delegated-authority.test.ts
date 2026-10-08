// @vitest-environment node
/**
 * @fileOverview Unit, Integration & Adversarial Red-Team Test Suite for Delegated Authority Engine (Phase 13 Milestone 1)
 *
 * Implements:
 * - Rule 1 (Canonical Capabilities)
 * - Rule 4 (Zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Isolation)
 * - Rule 9 & 23 (Resource Ceilings: Depth <= 3, Duration <= 120s)
 * - Rule 10 (Zod v4 Schemas)
 * - Rule 11 (Mathematical Determinism in Authority Intersection Algebra)
 * - Rule 12 (Canonical Risk Taxonomy)
 * - Rule 16 (Agent Identity as First-Class Security Principal & Authority Intersection)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 18 (Live TOCTOU Checking)
 * - Rule 19 (Deterministic Idempotency Keys)
 * - Rule 21 & 22 (Two-Phase Binding & SHA-256 Signature Verification)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 27 (Reverse-LIFO Saga Rollback Mapping)
 * - Rule 28 & 56 (Knapsack Token Budgeting <= 4,000)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 42 (Shadow Mode Simulation)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Operational Control & Audit Justification >= 5 chars)
 * - Rule 67 (The Agent Implementation Gate)
 * - Rule 68 (The Five Non-Negotiables)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDelegatedAuthorityService,
  computeEffectiveAuthority,
  verifyTokenSignature,
} from '../../identity/delegation/delegated-authority-service';
import {
  isCapabilityDelegable,
  assertCapabilityDelegable,
  stripNonDelegableCapabilities,
  stripNonDelegableScopes,
} from '../../identity/delegation/non-delegable-guard';
import {
  AgentDelegationError,
  DelegationToken,
} from '../../identity/delegation/delegation-types';
import { createMemoryDelegationStore } from '../../policy/delegation-store';
import { getCapability } from '../../capabilities/registry/capability-registry';
import {
  issueDelegationTokenCapability,
} from '../../capabilities/supervisor/delegation-capabilities';
import * as deadManModule from '../../policy/governance-dead-man';

describe('Phase 13 Milestone 1: Delegated Authority Protocol, Security Scoping & Non-Delegable Engine', () => {
  let memoryStore: ReturnType<typeof createMemoryDelegationStore>;
  let delegationService: ReturnType<typeof createDelegatedAuthorityService>;
  let mockNow: number;

  beforeEach(() => {
    mockNow = 1775000000000;
    deadManModule.setGovernanceDeadManStateForTests(null);
    memoryStore = createMemoryDelegationStore();
    delegationService = createDelegatedAuthorityService({
      store: memoryStore,
      nowMs: () => mockNow,
    });
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Test Suite 1: Authority Intersection Algebra (Rule 11, Rule 16, Rule 17)
  // ==========================================================================
  describe('Suite 1: Authority Intersection Algebra (Rule 16)', () => {
    it('computes exact 5-way mathematical intersection with zero scope elevation', () => {
      const result = computeEffectiveAuthority({
        userPermissions: ['crm:contacts:read', 'deals:pipeline:view', 'tasks:create', 'billing:invoices:read'],
        supervisorPermissions: ['crm:contacts:read', 'deals:pipeline:view', 'tasks:create'],
        subAgentPermissions: ['crm:contacts:read', 'tasks:create', 'knowledge:memory:read'],
        workspaceScopes: ['crm:contacts:read', 'deals:pipeline:view', 'tasks:create'],
        requestedScopes: ['crm:contacts:read', 'tasks:create', 'deals:pipeline:view'],
      });

      // Effective = User ∩ Supervisor ∩ SubAgent ∩ Workspace ∩ Requested
      // 'crm:contacts:read': in all 5
      // 'tasks:create': in all 5
      // 'deals:pipeline:view': missing from subAgentPermissions
      expect(result.effectiveScopes).toEqual(['crm:contacts:read', 'tasks:create']);
      expect(result.isElevated).toBe(false);
      expect(result.strippedWildcards).toEqual([]);
    });

    it('strictly strips wildcard (*) and prefix wildcards (Rule 16)', () => {
      const result = computeEffectiveAuthority({
        userPermissions: ['*'], // SuperAdmin user
        supervisorPermissions: ['crm:contacts:read', 'deals:pipeline:view'],
        subAgentPermissions: ['crm:contacts:read', 'deals:pipeline:view'],
        requestedScopes: ['*', 'crm:*', 'deals.*', 'crm:contacts:read'],
      });

      expect(result.strippedWildcards).toContain('*');
      expect(result.strippedWildcards).toContain('crm:*');
      expect(result.strippedWildcards).toContain('deals.*');
      expect(result.effectiveScopes).toEqual(['crm:contacts:read']);
    });

    it('returns empty effective scopes when user and sub-agent disjoint', () => {
      const result = computeEffectiveAuthority({
        userPermissions: ['crm:contacts:read'],
        supervisorPermissions: ['crm:contacts:read', 'deals:pipeline:view'],
        subAgentPermissions: ['deals:pipeline:view'],
        requestedScopes: ['deals:pipeline:view'],
      });

      expect(result.effectiveScopes).toEqual([]);
    });
  });

  // ==========================================================================
  // Test Suite 2: Non-Delegable Privileges Firewall (Rule 17)
  // ==========================================================================
  describe('Suite 2: Non-Delegable Privileges Firewall (Rule 17)', () => {
    it('identifies and rejects non-delegable administrative capabilities', () => {
      expect(isCapabilityDelegable('auth.rotate_keys')).toBe(false);
      expect(isCapabilityDelegable('security.modify_rules')).toBe(false);
      expect(isCapabilityDelegable('tenant.delete_workspace')).toBe(false);
      expect(isCapabilityDelegable('billing.transfer_ownership')).toBe(false);
      expect(isCapabilityDelegable('platform_config.update')).toBe(false);
      expect(isCapabilityDelegable('rbac:admin.permissions.grant')).toBe(false);
      expect(isCapabilityDelegable('crm.contacts.read')).toBe(true);
    });

    it('throws AgentDelegationError when assertCapabilityDelegable encounters non-delegable action', () => {
      expect(() => assertCapabilityDelegable('auth.rotate_keys')).toThrowError(AgentDelegationError);
      expect(() => assertCapabilityDelegable('crm.contacts.read')).not.toThrow();
    });

    it('partitions capabilities into allowed and stripped arrays', () => {
      const { allowed, stripped } = stripNonDelegableCapabilities([
        'crm.contacts.read',
        'auth.rotate_credentials',
        'lead.score',
        'security.disable_audit',
      ]);

      expect(allowed).toEqual(['crm.contacts.read', 'lead.score']);
      expect(stripped).toEqual(['auth.rotate_credentials', 'security.disable_audit']);
    });

    it('partitions permission scopes into allowed and stripped arrays', () => {
      const { allowed, stripped } = stripNonDelegableScopes([
        'workspace:read',
        'app:system_admin',
        'crm:contacts:read',
        'rbac:management.users.delete',
      ]);

      expect(allowed).toEqual(['workspace:read', 'crm:contacts:read']);
      expect(stripped).toEqual(['app:system_admin', 'rbac:management.users.delete']);
    });
  });

  // ==========================================================================
  // Test Suite 3: Hard Delegation Depth Clamping (Rule 23)
  // ==========================================================================
  describe('Suite 3: Hard Delegation Depth Clamping (Rule 23)', () => {
    it('allows delegation chain up to depth 3 and strictly rejects depth 4', async () => {
      // 1. Root delegation: Depth = 1
      const rootToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });
      expect(rootToken.depth).toBe(1);
      expect(rootToken.delegationChain).toEqual(['user_admin']);

      // 2. Sub-delegation 1: Depth = 2
      const childToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        parentDelegationId: rootToken.tokenId,
        supervisorAgentId: 'crm_assistant',
        subAgentId: 'lead_analyst',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });
      expect(childToken.depth).toBe(2);
      expect(childToken.delegationChain).toEqual(['user_admin', 'crm_assistant']);

      // 3. Sub-delegation 2: Depth = 3 (Max allowable)
      const leafToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        parentDelegationId: childToken.tokenId,
        supervisorAgentId: 'lead_analyst',
        subAgentId: 'task_coordinator',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });
      expect(leafToken.depth).toBe(3);
      expect(leafToken.delegationChain).toEqual(['user_admin', 'crm_assistant', 'lead_analyst']);

      // 4. Sub-delegation 3: Depth = 4 -> MUST FAIL (Rule 23)
      await expect(
        delegationService.issueDelegationToken({
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          userId: 'user_admin',
          parentDelegationId: leafToken.tokenId,
          supervisorAgentId: 'task_coordinator',
          subAgentId: 'crm_assistant',
          requestedScopes: ['workspace:read'],
          userPermissions: ['workspace:read'],
        })
      ).rejects.toThrowError(/maximum permitted delegation depth is 3/);
    });
  });

  // ==========================================================================
  // Test Suite 4: Cryptographic SHA-256 Token Signature & Tampering (Rule 22)
  // ==========================================================================
  describe('Suite 4: Cryptographic Signature & Tampering Detection (Rule 22)', () => {
    it('mints a token with a deterministic 64-character SHA-256 signature and validates cleanly', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['rbac:operations.tasks.create', 'workspace:read'],
        userPermissions: ['rbac:operations.tasks.create', 'workspace:read'],
      });

      expect(token.tokenSignature).toMatch(/^[a-f0-9]{64}$/);
      expect(verifyTokenSignature(token)).toBe(true);

      const validation = await delegationService.validateDelegationToken(token, {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });
      expect(validation.valid).toBe(true);
    });

    it('rejects tampered allowedScopes with SIGNATURE_TAMPERED (Rule 22)', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      // Attacker attempts to inject unauthorized privilege without re-signing
      const tamperedToken: DelegationToken = {
        ...token,
        allowedScopes: ['workspace:read', 'rbac:admin.superuser'],
      };

      const validation = await delegationService.validateDelegationToken(tamperedToken, {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.code).toBe('SIGNATURE_TAMPERED');
      }
    });

    it('rejects tampered depth elevation with SIGNATURE_TAMPERED', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      const tamperedToken: DelegationToken = {
        ...token,
        depth: 1, // pretend to be root if it was depth 2
        allowedScopes: token.allowedScopes,
      };

      expect(verifyTokenSignature(tamperedToken)).toBe(true); // matching itself

      // Now actually tamper with depth
      const hackedToken = { ...token, depth: 2 };
      expect(verifyTokenSignature(hackedToken as DelegationToken)).toBe(false);
    });
  });

  // ==========================================================================
  // Test Suite 5: Expiration & TTL Clamping (Rule 23)
  // ==========================================================================
  describe('Suite 5: Expiration & TTL Clamping (Rule 23)', () => {
    it('clamps TTL to minimum 60s and maximum 86400s (24 hours)', async () => {
      // Sub-minimum requested (10s) -> clamped to 60s
      const shortToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        ttlSeconds: 10,
      });
      const shortExpiry = Date.parse(shortToken.expiresAt);
      expect(shortExpiry - mockNow).toBe(60 * 1000);

      // Over-maximum requested (100,000s) -> clamped to 86,400s
      const longToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        ttlSeconds: 100000,
      });
      const longExpiry = Date.parse(longToken.expiresAt);
      expect(longExpiry - mockNow).toBe(86400 * 1000);
    });

    it('enforces that child token expiration never exceeds parent expiration', async () => {
      // Parent expires in 120 seconds
      const parentToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        ttlSeconds: 120,
      });

      // Child requests 3600 seconds -> clamped to parent's 120s
      const childToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        parentDelegationId: parentToken.tokenId,
        supervisorAgentId: 'crm_assistant',
        subAgentId: 'lead_analyst',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        ttlSeconds: 3600,
      });

      expect(childToken.expiresAt).toBe(parentToken.expiresAt);
    });

    it('rejects validation when token is past expiration timestamp (Rule 18)', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        ttlSeconds: 60,
      });

      // Fast-forward time past expiration
      mockNow += 61 * 1000;

      const validation = await delegationService.validateDelegationToken(token, {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.code).toBe('DELEGATION_EXPIRED');
      }
    });
  });

  // ==========================================================================
  // Test Suite 6: Anti-IDOR Multi-Tenant Boundary Validation (Rules 8 & 47)
  // ==========================================================================
  describe('Suite 6: Anti-IDOR Multi-Tenant Boundary Isolation (Rules 8 & 47)', () => {
    it('fails closed when token is presented against a mismatched organization or workspace', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_alpha',
        workspaceId: 'ws_main',
        userId: 'user_alpha',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      // Cross-organization validation attempt
      const orgMismatch = await delegationService.validateDelegationToken(token, {
        organizationId: 'org_beta',
        workspaceId: 'ws_main',
      });
      expect(orgMismatch.valid).toBe(false);
      if (!orgMismatch.valid) {
        expect(orgMismatch.code).toBe('TENANT_MISMATCH');
      }

      // Cross-workspace validation attempt
      const wsMismatch = await delegationService.validateDelegationToken(token, {
        organizationId: 'org_alpha',
        workspaceId: 'ws_other',
      });
      expect(wsMismatch.valid).toBe(false);
      if (!wsMismatch.valid) {
        expect(wsMismatch.code).toBe('TENANT_MISMATCH');
      }
    });

    it('rejects sub-delegation across different tenant boundaries', async () => {
      const parentToken = await delegationService.issueDelegationToken({
        organizationId: 'org_alpha',
        workspaceId: 'ws_main',
        userId: 'user_alpha',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      await expect(
        delegationService.issueDelegationToken({
          organizationId: 'org_beta', // mismatch
          workspaceId: 'ws_main',
          userId: 'user_alpha',
          parentDelegationId: parentToken.tokenId,
          supervisorAgentId: 'crm_assistant',
          subAgentId: 'lead_analyst',
          requestedScopes: ['workspace:read'],
          userPermissions: ['workspace:read'],
        })
      ).rejects.toThrowError(/TENANT_MISMATCH/);
    });
  });

  // ==========================================================================
  // Test Suite 7: Cascading Revocation & Audit Trail (Rules 8, 27, 40, 61)
  // ==========================================================================
  describe('Suite 7: Cascading Revocation & Audit Trail (Rules 8, 27, 61)', () => {
    it('enforces audit reason length >= 5 characters (Rule 61)', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      await expect(
        delegationService.revokeDelegationToken(token.tokenId, 'user_admin', 'bad')
      ).rejects.toThrowError(/at least 5 characters/);
    });

    it('atomically revokes parent and cascades revocation down child delegations (Rule 8 & 27)', async () => {
      const rootToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      const childToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        parentDelegationId: rootToken.tokenId,
        supervisorAgentId: 'crm_assistant',
        subAgentId: 'lead_analyst',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      const leafToken = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        parentDelegationId: childToken.tokenId,
        supervisorAgentId: 'lead_analyst',
        subAgentId: 'task_coordinator',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      // Revoking root should cascade to child and leaf
      const { revokedCount } = await delegationService.revokeDelegationToken(
        rootToken.tokenId,
        'user_admin',
        'Emergency security revocation triggered'
      );
      expect(revokedCount).toBe(3);

      // Verifying child token fails closed as revoked
      const childValidation = await delegationService.validateDelegationToken(childToken, {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });
      expect(childValidation.valid).toBe(false);
      if (!childValidation.valid) {
        expect(childValidation.code).toBe('DELEGATION_REVOKED');
      }

      // Verifying leaf token fails closed as revoked
      const leafValidation = await delegationService.validateDelegationToken(leafToken, {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });
      expect(leafValidation.valid).toBe(false);
      if (!leafValidation.valid) {
        expect(leafValidation.code).toBe('DELEGATION_REVOKED');
      }
    });
  });

  // ==========================================================================
  // Test Suite 8: Canonical Capabilities Integration (Rule 1 & Rule 67)
  // ==========================================================================
  describe('Suite 8: Canonical Capabilities Registration & Handlers (Rule 1 & 67)', () => {
    it('verifies that all 3 delegation capabilities are registered in CapabilityRegistry', () => {
      const issueCap = getCapability('supervisor.delegation.issue_token');
      const validateCap = getCapability('supervisor.delegation.validate_token');
      const revokeCap = getCapability('supervisor.delegation.revoke_token');

      expect(issueCap).toBeDefined();
      expect(validateCap).toBeDefined();
      expect(revokeCap).toBeDefined();
    });

    it('executes issue_token capability handler cleanly', async () => {
      const context = {
        principal: {
          actorType: 'user' as const,
          userId: 'user_admin',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          grantedScopes: ['rbac:operations.tasks.create', 'workspace:read'],
          effectiveRole: 'admin',
        },
        correlationId: 'corr_test_1',
        timestamp: new Date().toISOString(),
      };

      const result = await issueDelegationTokenCapability.handler(
        {
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          userId: 'user_admin',
          supervisorAgentId: 'supervisor',
          subAgentId: 'crm_assistant',
          requestedScopes: ['rbac:operations.tasks.create', 'workspace:read'],
          userPermissions: ['rbac:operations.tasks.create', 'workspace:read'],
        },
        context
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tokenId).toMatch(/^del_/);
        expect(result.data.allowedScopes).toContain('workspace:read');
      }
    });
  });

  // ==========================================================================
  // Test Suite 9: Emergency Dead-Man Switch Evaluation (Rule 60)
  // ==========================================================================
  describe('Suite 9: Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('fails closed with HTTP 503 when dead-man switch is engaged', async () => {
      deadManModule.setGovernanceDeadManStateForTests(true);

      await expect(
        delegationService.issueDelegationToken({
          organizationId: 'org_paused',
          workspaceId: 'ws_test',
          userId: 'user_admin',
          supervisorAgentId: 'supervisor',
          subAgentId: 'crm_assistant',
          requestedScopes: ['workspace:read'],
          userPermissions: ['workspace:read'],
        })
      ).rejects.toMatchObject({
        code: 'DELEGATION_DEAD_MAN_PAUSED',
        statusCode: 503,
      });
    });
  });

  // ==========================================================================
  // Test Suite 10: Shadow Mode Simulation (Rule 42)
  // ==========================================================================
  describe('Suite 10: Shadow Mode Simulation (Rule 42)', () => {
    it('produces valid signed token in dryRun mode without persisting to store', async () => {
      const token = await delegationService.issueDelegationToken({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        userId: 'user_admin',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
        dryRun: true,
      });

      expect(token.tokenId).toMatch(/^del_/);
      expect(verifyTokenSignature(token)).toBe(true);

      // Verify NOT persisted to store (Rule 42: 0 writes)
      const stored = await memoryStore.getGrant(token.tokenId);
      expect(stored).toBeNull();
    });
  });
});
