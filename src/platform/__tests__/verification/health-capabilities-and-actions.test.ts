/**
 * @fileOverview Unit & Security Tests for Health Capabilities & Server Actions (Phase 14 Milestone 4)
 *
 * Implements:
 * - Rule 1 (Canonical Capabilities)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Checks)
 * - Rule 12 (Risk Taxonomy: L0_READ, L2_STATE_MUTATION)
 * - Rule 16 (Scoped Non-Wildcard RBAC)
 * - Rule 17 (Non-Delegable Restrictions: reset_circuit_breaker is Non-Delegable)
 * - Rule 48 (Sanitized Error Taxonomy)
 * - Rule 51 (Next.js 15 Server Actions Conventions)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Mandatory Justification for Operator Actions >= 5 chars)
 * - Rule 69 (Strangler Fig Invariant)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  getAgentHealthScorecardAction,
  listAgentHealthScorecardsAction,
  resetAgentCircuitBreakerAction,
  evaluateDiscrepancyAction,
} from '@/app/actions/agent-health-actions';
import { getAgentHealthService } from '@/platform/verification/health/agent-health-service';
import '@/platform/capabilities/health';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
}));

describe('Phase 14 Milestone 4 - Health Capabilities & Server Actions', () => {
  const validOrgId = 'org_test_health';
  const validWsId = 'ws_test_health';
  const callerUid = 'usr_operator_health';

  beforeEach(() => {
    vi.restoreAllMocks();

    getAgentHealthService().clearHistoryForTests();

    vi.mocked(requireAuth).mockResolvedValue({
      uid: callerUid,
      claims: { sub: callerUid },
      profile: {
        id: callerUid,
        email: 'operator@smartsapp.com',
        role: 'admin',
        organizationId: validOrgId,
        lastActiveWorkspaceId: validWsId,
      },
      isSystemAdmin: false,
    } as unknown as Awaited<ReturnType<typeof requireAuth>>);

    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  describe('Canonical Health Capabilities (Rules 1, 12, 17)', () => {
    it('registers health.get_scorecard with L0_READ and health:read permission', () => {
      const cap = getCapability('health.get_scorecard');
      expect(cap).toBeDefined();
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('health:read');
      expect(cap?.risk.nonDelegable).toBe(false);
    });

    it('registers health.list_scorecards with L0_READ and health:read permission', () => {
      const cap = getCapability('health.list_scorecards');
      expect(cap).toBeDefined();
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('health:read');
    });

    it('registers health.reset_circuit_breaker with L2_STATE_MUTATION and nonDelegable: true (Rule 17)', () => {
      const cap = getCapability('health.reset_circuit_breaker');
      expect(cap).toBeDefined();
      expect(cap?.risk.level).toBe('L2_STATE_MUTATION');
      expect(cap?.permissions).toContain('health:manage');
      expect(cap?.risk.nonDelegable).toBe(true);
      expect(cap?.policies.auditRequired).toBe(true);
      expect(cap?.policies.requiresIdempotencyKey).toBe(true);
    });

    it('registers health.evaluate_discrepancy with L0_READ', () => {
      const cap = getCapability('health.evaluate_discrepancy');
      expect(cap).toBeDefined();
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.permissions).toContain('health:read');
    });

    it('executes health.get_scorecard capability handler successfully', async () => {
      const cap = getCapability('health.get_scorecard');
      expect(cap).toBeDefined();

      const result = await cap!.handler(
        {
          personaId: 'lead_sdr',
          organizationId: validOrgId,
          workspaceId: validWsId,
        },
        {
          correlationId: 'corr_test_1',
          timestamp: new Date().toISOString(),
          principal: {
            actorType: 'user',
            userId: callerUid,
            organizationId: validOrgId,
            workspaceId: validWsId,
            effectiveRole: 'admin',
            grantedScopes: ['health:read'],
          },
        }
      );

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Handler failed');
      expect(result.data).toBeDefined();
      expect((result.data as { personaId: string }).personaId).toBe('lead_sdr');
    });
  });

  describe('Server Actions: getAgentHealthScorecardAction', () => {
    it('returns agent scorecard for authorized caller', async () => {
      const res = await getAgentHealthScorecardAction({
        personaId: 'billing_analyst',
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(res.success).toBe(true);
      expect(res.data?.personaId).toBe('billing_analyst');
      expect(res.data?.healthScore).toBe(100);
      expect(res.data?.circuitState).toBe('CLOSED');
    });

    it('rejects cross-tenant lookup with IDOR_VIOLATION (Rules 8 & 47)', async () => {
      const res = await getAgentHealthScorecardAction({
        personaId: 'billing_analyst',
        organizationId: 'other_org_trespass',
        workspaceId: validWsId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValue(new Error('Dead man paused'));

      const res = await getAgentHealthScorecardAction({
        personaId: 'billing_analyst',
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('HEALTH_DEAD_MAN_PAUSED');
    });
  });

  describe('Server Actions: listAgentHealthScorecardsAction', () => {
    it('lists all scorecards in caller workspace', async () => {
      await getAgentHealthService().recordTelemetry({
        personaId: 'knowledge_agent',
        executionId: 'exec_list_action',
        capabilityId: 'knowledge.search',
        organizationId: validOrgId,
        workspaceId: validWsId,
        success: true,
        durationMs: 400,
      });

      const res = await listAgentHealthScorecardsAction({
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data?.some((s) => s.personaId === 'knowledge_agent')).toBe(true);
    });

    it('rejects cross-tenant list query with IDOR_VIOLATION', async () => {
      const res = await listAgentHealthScorecardsAction({
        organizationId: 'malicious_tenant',
        workspaceId: validWsId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('Server Actions: resetAgentCircuitBreakerAction', () => {
    it('resets a tripped circuit breaker when justification is >= 5 chars (Rule 61)', async () => {
      // First trip the supervisor persona
      for (let i = 1; i <= 2; i++) {
        await getAgentHealthService().recordTelemetry({
          personaId: 'supervisor',
          executionId: `trip_${i}`,
          capabilityId: 'supervisor.route',
          organizationId: validOrgId,
          workspaceId: validWsId,
          success: false,
          durationMs: 900,
        });
      }

      const res = await resetAgentCircuitBreakerAction({
        personaId: 'supervisor',
        organizationId: validOrgId,
        workspaceId: validWsId,
        justification: 'Database read replicas stabilized and verified.',
      });

      expect(res.success).toBe(true);
      expect(res.data?.circuitState).toBe('HALF_OPEN');
      expect(res.data?.status).toBe('HEALTHY');
      expect(res.data?.consecutiveFailures).toBe(0);
    });

    it('rejects reset with HEALTH_INVALID_JUSTIFICATION if justification < 5 chars (Rule 61)', async () => {
      const res = await resetAgentCircuitBreakerAction({
        personaId: 'supervisor',
        organizationId: validOrgId,
        workspaceId: validWsId,
        justification: 'fix',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('HEALTH_INVALID_JUSTIFICATION');
    });

    it('rejects cross-tenant reset with IDOR_VIOLATION', async () => {
      const res = await resetAgentCircuitBreakerAction({
        personaId: 'supervisor',
        organizationId: 'other_rogue_org',
        workspaceId: validWsId,
        justification: 'Valid length justification but invalid org ID.',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('Server Actions: evaluateDiscrepancyAction', () => {
    it('evaluates discrepancy and returns report', async () => {
      const res = await evaluateDiscrepancyAction({
        executionId: 'exec_action_disc',
        capabilityId: 'crm.deal.update',
        organizationId: validOrgId,
        workspaceId: validWsId,
        targetResource: 'deal',
        targetId: 'deal_action_1',
        predictedChange: { stage: 'WON' },
        actualChange: { stage: 'WON' },
        autoHeal: false,
      });

      expect(res.success).toBe(true);
      expect(res.data?.varianceType).toBe('NO_VARIANCE');
      expect(res.data?.isRemediable).toBe(true);
    });

    it('rejects cross-tenant discrepancy evaluation with IDOR_VIOLATION', async () => {
      const res = await evaluateDiscrepancyAction({
        executionId: 'exec_action_disc_idor',
        capabilityId: 'crm.deal.update',
        organizationId: 'foreign_org',
        workspaceId: validWsId,
        targetResource: 'deal',
        targetId: 'deal_action_1',
        predictedChange: {},
        actualChange: {},
        autoHeal: false,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });
  });
});
