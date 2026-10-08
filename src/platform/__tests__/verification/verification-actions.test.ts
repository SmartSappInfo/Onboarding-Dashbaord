/**
 * @fileOverview Unit & Security Tests for Verification Server Actions (Phase 14 Milestone 1)
 *
 * Implements Rules 4, 8, 10, 47, 48, 51, 60, and 69.
 * Verifies:
 * - Session authentication guarding (requireAuth)
 * - Anti-IDOR multi-tenant boundary checks
 * - Emergency dead-man switch fail-closed semantics (VERIFICATION_DEAD_MAN_PAUSED)
 * - Postcondition evaluation execution and structured result formatting
 * - Execution verification history lookup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluatePostconditionsAction,
  getExecutionVerificationAction,
} from '@/app/actions/verification-actions';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
}));

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Phase 14 Milestone 1 - Verification Server Actions', () => {
  const validOrgId = 'org_enterprise';
  const validWsId = 'ws_sales';
  const callerUid = 'usr_operator_1';

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({
      uid: callerUid,
      claims: { sub: callerUid },
      profile: {
        id: callerUid,
        email: 'operator@enterprise.com',
        role: 'admin',
        organizationId: validOrgId,
        lastActiveWorkspaceId: validWsId,
      },
      isSystemAdmin: false,
    } as unknown as Awaited<ReturnType<typeof requireAuth>>);

    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  describe('evaluatePostconditionsAction', () => {
    it('executes postcondition evaluation and returns successful VerificationResult', async () => {
      const response = await evaluatePostconditionsAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: { id: 'deal_1', stage: 'QUALIFICATION' },
        postStateSnapshot: { id: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
        mutationPayload: { dealId: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.overallStatus).toBe('PASS');
      expect(response.data?.passedCount).toBe(1);
    });

    it('rejects cross-tenant caller context with IDOR_VIOLATION', async () => {
      const response = await evaluatePostconditionsAction({
        organizationId: 'org_attacker_tenant',
        workspaceId: validWsId,
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: {},
        postStateSnapshot: {},
        mutationPayload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('IDOR_VIOLATION');
      expect(response.error?.message).toContain('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is engaged', async () => {
      vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
        new Error('Emergency governance active')
      );

      const response = await evaluatePostconditionsAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: {},
        postStateSnapshot: {},
        mutationPayload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VERIFICATION_DEAD_MAN_PAUSED');
    });

    it('handles authentication failure gracefully', async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized session'));

      const response = await evaluatePostconditionsAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: {},
        postStateSnapshot: {},
        mutationPayload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('getExecutionVerificationAction', () => {
    it('retrieves verification result for an existing execution', async () => {
      const evalResponse = await evaluatePostconditionsAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        capabilityId: 'crm.deal.advance_stage',
        preStateSnapshot: { id: 'deal_1', stage: 'QUALIFICATION' },
        postStateSnapshot: { id: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
        mutationPayload: { dealId: 'deal_1', stage: 'PROPOSAL_SUBMITTED' },
      });

      const executionId = evalResponse.data!.executionId;

      const fetchResponse = await getExecutionVerificationAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
        executionId,
      });

      expect(fetchResponse.success).toBe(true);
      expect(fetchResponse.data?.executionId).toBe(executionId);
    });

    it('enforces Anti-IDOR boundary check on retrieval', async () => {
      const response = await getExecutionVerificationAction({
        organizationId: 'org_other_tenant',
        workspaceId: validWsId,
        executionId: 'exec_123',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('IDOR_VIOLATION');
    });
  });
});
