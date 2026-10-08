// @vitest-environment node
/**
 * @fileOverview Unit & Security Test Suite for Delegation Server Actions (Phase 13 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Scoping)
 * - Rule 16 (Authority Intersection Algebra & Agent Identity)
 * - Rule 22 (Cryptographic Signature Verification)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Audit Trail: >= 5 char justification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  issueDelegationTokenAction,
  validateDelegationTokenAction,
  revokeDelegationTokenAction,
  computeEffectiveAuthorityAction,
} from '@/app/actions/delegation-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

describe('Delegation Server Actions (Phase 13 Milestone 1)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      uid: 'user_operator_1',
      profile: {
        id: 'user_operator_1',
        name: 'Enterprise Operator',
        email: 'operator@smartsapp.com',
        role: 'admin',
        organizationId: 'org_enterprise_1',
        workspaceIds: ['ws_main'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isSystemAdmin: false,
    }));

    const { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } = await import(
      '@/platform/policy/governance-dead-man'
    );
    vi.mocked(checkGovernanceDeadManSwitch).mockImplementation(async (orgId?: string) => {
      if (orgId === 'org_paused') {
        throw new AgentGovernanceEmergencyPausedError('Emergency pause engaged for testing');
      }
      return;
    });
  });

  describe('issueDelegationTokenAction', () => {
    it('mints a valid delegation token for authenticated tenant caller', async () => {
      const result = await issueDelegationTokenAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.tokenId).toMatch(/^del_/);
      expect(result.data?.allowedScopes).toContain('workspace:read');
      expect(result.data?.tokenSignature).toBeDefined();
    });

    it('rejects cross-tenant minting attempt with IDOR TENANT_MISMATCH (Rule 8 & 47)', async () => {
      const result = await issueDelegationTokenAction({
        organizationId: 'org_other_tenant', // IDOR probe
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_operator_1',
        profile: {
          id: 'user_operator_1',
          name: 'Enterprise Operator',
          email: 'operator@smartsapp.com',
          role: 'admin',
          organizationId: 'org_paused',
          workspaceIds: ['ws_main'],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      }));

      const result = await issueDelegationTokenAction({
        organizationId: 'org_paused',
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('DELEGATION_DEAD_MAN_PAUSED');
    });
  });

  describe('validateDelegationTokenAction', () => {
    it('validates a well-formed signed delegation token', async () => {
      // First mint a token
      const issueRes = await issueDelegationTokenAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });
      expect(issueRes.success).toBe(true);

      const valRes = await validateDelegationTokenAction({
        token: issueRes.data!,
        targetContext: {
          organizationId: 'org_enterprise_1',
          workspaceId: 'ws_main',
        },
      });

      expect(valRes.success).toBe(true);
      expect(valRes.data?.valid).toBe(true);
    });

    it('fails closed when validating against cross-tenant execution target', async () => {
      const issueRes = await issueDelegationTokenAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_operator_1',
        profile: {
          id: 'user_operator_1',
          name: 'Enterprise Operator',
          email: 'operator@smartsapp.com',
          role: 'admin',
          organizationId: 'org_enterprise_1',
          workspaceIds: ['ws_main'],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: true, // system admin trying to cross-validate
      }));

      const valRes = await validateDelegationTokenAction({
        token: issueRes.data!,
        targetContext: {
          organizationId: 'org_other_target',
          workspaceId: 'ws_main',
        },
      });

      expect(valRes.success).toBe(true);
      expect(valRes.data?.valid).toBe(false);
      if (!valRes.data?.valid) {
        expect(valRes.data?.code).toBe('TENANT_MISMATCH');
      }
    });
  });

  describe('revokeDelegationTokenAction', () => {
    it('revokes an active delegation token with valid audit reason (Rule 61)', async () => {
      const issueRes = await issueDelegationTokenAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        userId: 'user_operator_1',
        supervisorAgentId: 'supervisor',
        subAgentId: 'crm_assistant',
        requestedScopes: ['workspace:read'],
        userPermissions: ['workspace:read'],
      });

      const revokeRes = await revokeDelegationTokenAction({
        tokenId: issueRes.data!.tokenId,
        revokerId: 'user_operator_1',
        reason: 'Revoked due to security parameter rotation',
      });

      expect(revokeRes.success).toBe(true);
      expect(revokeRes.data?.revokedCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects revocation with reason shorter than 5 characters (Rule 61)', async () => {
      const revokeRes = await revokeDelegationTokenAction({
        tokenId: 'del_dummy_1',
        revokerId: 'user_operator_1',
        reason: 'no',
      });

      expect(revokeRes.success).toBe(false);
      expect(revokeRes.code).toBe('INVALID_INPUT');
    });
  });

  describe('computeEffectiveAuthorityAction', () => {
    it('computes pure authority intersection without code execution', async () => {
      const result = await computeEffectiveAuthorityAction({
        userPermissions: ['workspace:read', 'crm:contacts:read'],
        supervisorPermissions: ['workspace:read', 'crm:contacts:read'],
        subAgentPermissions: ['workspace:read'],
        requestedScopes: ['workspace:read', 'crm:contacts:read'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.effectiveScopes).toEqual(['workspace:read']);
      expect(result.data?.isElevated).toBe(false);
    });
  });
});
