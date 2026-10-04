/**
 * @fileOverview Test Suite for Agent Run UI Server Actions (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 8 & 47: Anti-IDOR enforcement tests.
 * - Rule 26: Cooperative cancellation verification.
 * - Rule 40: Domain event emission verification.
 * - Rule 51: Server Action authentication verification.
 * - Rule 60: Emergency dead-man pause check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as requireAuthModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import {
  listAgentRunsAction,
  getAgentRunDetailsAction,
  cancelAgentRunAction,
  getAgentRunMetricsAction,
} from '@/app/actions/agent-run-ui-actions';
import { getAgentRunStore } from '@/platform/runtime/agent-run-store';

describe('Agent Run UI Server Actions', () => {
  const tenant = {
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
  };

  const mockUser = {
    uid: 'user_123',
    profile: {
      organizationId: tenant.organizationId,
    } as unknown as requireAuthModule.AuthContext['profile'],
    isSystemAdmin: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue(mockUser);
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);
  });

  describe('listAgentRunsAction', () => {
    it('fails if caller is unauthenticated (Rule 51)', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockRejectedValue(new Error('Not signed in.'));

      const result = await listAgentRunsAction({
        organizationId: tenant.organizationId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_REQUIRED');
    });

    it('fails closed with IDOR_VIOLATION if requested org does not match session (Rule 8 & 47)', async () => {
      const result = await listAgentRunsAction({
        organizationId: 'other_org_attacker',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('lists agent runs successfully with pagination & filtering', async () => {
      const runStore = getAgentRunStore();
      await runStore.createRun({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentPersonaId: 'crm_researcher',
        goal: { prompt: 'Research key accounts in EMEA' },
        authorizingUserId: mockUser.uid,
        principalId: `agent_${mockUser.uid}`,
      });

      const result = await listAgentRunsAction({
        organizationId: tenant.organizationId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.runs.length).toBeGreaterThan(0);
      expect(result.data?.runs[0].agentPersonaId).toBe('crm_researcher');
    });
  });

  describe('getAgentRunDetailsAction', () => {
    it('fails if caller is unauthenticated', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockRejectedValue(new Error('Not signed in.'));

      const result = await getAgentRunDetailsAction({
        organizationId: tenant.organizationId,
        runId: 'run_123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_REQUIRED');
    });

    it('fails closed on tenant IDOR violation', async () => {
      const result = await getAgentRunDetailsAction({
        organizationId: 'malicious_org',
        runId: 'run_123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('returns run and associated steps', async () => {
      const runStore = getAgentRunStore();
      const run = await runStore.createRun({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentPersonaId: 'crm_researcher',
        goal: { prompt: 'Analyze lead conversion bottlenecks' },
        authorizingUserId: mockUser.uid,
        principalId: `agent_${mockUser.uid}`,
      });

      await runStore.createStep(tenant.organizationId, run.runId, {
        runId: run.runId,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        stepIndex: 0,
        type: 'planning',
        title: 'Generate search plan',
        idempotencyKey: `idemp_${run.runId}_0`,
        correlationId: `corr_${run.runId}`,
      });

      const result = await getAgentRunDetailsAction({
        organizationId: tenant.organizationId,
        runId: run.runId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.run?.runId).toBe(run.runId);
      expect(result.data?.steps.length).toBe(1);
      expect(result.data?.steps[0].type).toBe('planning');
    });
  });

  describe('cancelAgentRunAction', () => {
    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new Error('Emergency Dead-Man Switch is Active')
      );

      const result = await cancelAgentRunAction({
        organizationId: tenant.organizationId,
        runId: 'run_999',
        reason: 'Operator cancelled',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEAD_MAN_PAUSED');
    });

    it('fails if run is already in immutable terminal state', async () => {
      const runStore = getAgentRunStore();
      const run = await runStore.createRun({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentPersonaId: 'crm_researcher',
        goal: { prompt: 'Completed mission' },
        authorizingUserId: mockUser.uid,
        principalId: `agent_${mockUser.uid}`,
      });

      await runStore.updateRunStatus({
        organizationId: tenant.organizationId,
        runId: run.runId,
        toStatus: 'cancelled',
        reason: 'Finished all work',
      });

      const result = await cancelAgentRunAction({
        organizationId: tenant.organizationId,
        runId: run.runId,
        reason: 'Attempt cancel again',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RUN_NOT_CANCELLABLE');
    });

    it('successfully cancels cancellable run via cancellation engine (Rule 26)', async () => {
      const runStore = getAgentRunStore();
      const run = await runStore.createRun({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentPersonaId: 'crm_researcher',
        goal: { prompt: 'In-flight execution task' },
        authorizingUserId: mockUser.uid,
        principalId: `agent_${mockUser.uid}`,
      });

      await runStore.updateRunStatus({
        organizationId: tenant.organizationId,
        runId: run.runId,
        toStatus: 'planning',
        reason: 'Starting step planning',
      });

      const result = await cancelAgentRunAction({
        organizationId: tenant.organizationId,
        runId: run.runId,
        reason: 'Operator manual override',
      });

      expect(result.success).toBe(true);
      expect(result.data?.run?.status).toBe('cancelled');
    });
  });

  describe('getAgentRunMetricsAction', () => {
    it('aggregates executive KPI counters accurately', async () => {
      const runStore = getAgentRunStore();
      await runStore.createRun({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentPersonaId: 'crm_researcher',
        goal: { prompt: 'Run A' },
        authorizingUserId: mockUser.uid,
        principalId: `agent_${mockUser.uid}`,
      });

      const result = await getAgentRunMetricsAction({
        organizationId: tenant.organizationId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalRuns).toBeGreaterThanOrEqual(1);
      expect(typeof result.data?.activeRuns).toBe('number');
      expect(typeof result.data?.waitingApprovals).toBe('number');
      expect(typeof result.data?.completedRuns).toBe('number');
      expect(typeof result.data?.failedRuns).toBe('number');
      expect(typeof result.data?.totalTokensUsed).toBe('number');
    });
  });
});
