/**
 * @fileOverview Governed Evaluation Server Actions Test Suite (Phase 15 Milestone 1)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  runEvaluationScenarioAction,
  runEvaluationBatchAction,
  getEvaluationBenchmarkSummaryAction,
  getHumanVsAgentBaselineAction,
} from '@/app/actions/evaluation-actions';
import * as requireAuthModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { getContinuousEvaluationEngine } from '@/platform/evaluation/engine/continuous-evaluation-engine';

describe('Phase 15 Milestone 1: Governed Evaluation Server Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getContinuousEvaluationEngine().clearHistory();

    // Default mock auth session
    vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue({
      uid: 'usr_admin_001',
      profile: {
        organizationId: 'org_test',
      },
      isSystemAdmin: false,
    } as unknown as requireAuthModule.AuthContext);

    // Default dead-man switch inactive
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue();
  });

  describe('runEvaluationScenarioAction', () => {
    it('executes a gold-standard scenario successfully for authorized caller', async () => {
      const res = await runEvaluationScenarioAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        scenarioId: 'eval_crm_01',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.scenarioId).toBe('eval_crm_01');
      expect(res.data?.dryRun).toBe(true);
      expect(res.data?.liveWritesCount).toBe(0);
    });

    it('rejects cross-tenant caller with IDOR_VIOLATION', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue({
        uid: 'usr_attacker',
        profile: {
          organizationId: 'org_attacker',
        },
        isSystemAdmin: false,
      } as unknown as requireAuthModule.AuthContext);

      const res = await runEvaluationScenarioAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        scenarioId: 'eval_crm_01',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('EVALUATION_IDOR_VIOLATION');
      expect(res.error?.message).toContain('IDOR Violation');
    });

    it('returns error when emergency dead-man switch is active', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValueOnce(
        new deadManModule.AgentGovernanceEmergencyPausedError('Dead man switch paused')
      );

      const res = await runEvaluationScenarioAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        scenarioId: 'eval_crm_01',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('EVALUATION_DEAD_MAN_PAUSED');
    });

    it('returns 404 error when scenario does not exist', async () => {
      const res = await runEvaluationScenarioAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        scenarioId: 'non_existent_scenario_999',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('EVALUATION_SCENARIO_NOT_FOUND');
    });
  });

  describe('runEvaluationBatchAction', () => {
    it('executes a batch of scenarios and returns aggregate counts', async () => {
      const res = await runEvaluationBatchAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        domainFilter: 'crm',
      });

      expect(res.success).toBe(true);
      expect(res.data?.totalExecuted).toBe(5);
      expect(res.data?.passCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects batch execution on tenant mismatch', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue({
        uid: 'usr_attacker',
        profile: {
          organizationId: 'org_attacker',
        },
        isSystemAdmin: false,
      } as unknown as requireAuthModule.AuthContext);

      const res = await runEvaluationBatchAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        domainFilter: 'crm',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('EVALUATION_IDOR_VIOLATION');
    });
  });

  describe('getEvaluationBenchmarkSummaryAction', () => {
    it('returns benchmark summary for valid tenant', async () => {
      // First populate with one run
      await runEvaluationScenarioAction({
        organizationId: 'org_test',
        workspaceId: 'ws_edu',
        scenarioId: 'eval_crm_01',
      });

      const res = await getEvaluationBenchmarkSummaryAction({
        organizationId: 'org_test',
        domainFilter: 'crm',
      });

      expect(res.success).toBe(true);
      expect(res.data?.domain).toBe('crm');
      expect(res.data?.scenarioCount).toBe(1);
    });
  });

  describe('getHumanVsAgentBaselineAction', () => {
    it('computes human vs agent baseline comparisons for scenario', async () => {
      const res = await getHumanVsAgentBaselineAction({
        organizationId: 'org_test',
        scenarioId: 'eval_crm_01',
      });

      expect(res.success).toBe(true);
      expect(res.data?.scenarioId).toBe('eval_crm_01');
      expect(res.data?.speedupFactor).toBeGreaterThan(0);
      expect(res.data?.contextBreadthFactor).toBeGreaterThan(0);
    });
  });
});
