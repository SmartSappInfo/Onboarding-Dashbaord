/**
 * @fileOverview Continuous Evaluation Engine Test Suite (Phase 15 Milestone 1)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContinuousEvaluationEngine,
  getContinuousEvaluationEngine,
} from '../../evaluation/engine/continuous-evaluation-engine';
import { EvaluationScenario } from '../../evaluation/contracts/evaluation-types';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';

const mockScenario: EvaluationScenario = {
  id: 'eval_crm_01',
  domain: 'crm',
  category: 'Account 360',
  title: 'Flagship Account Brief',
  description: 'Prepare account brief',
  inputQuery: 'Prepare account brief for Ghana International School',
  entityId: 'ent_gis_001',
  workspaceId: 'ws_edu',
  organizationId: 'org_test',
  groundTruthFacts: ['ACV is $180,000', 'Upcoming renewal in 90 days'],
  expectedPersona: 'crm_researcher',
  expectedRiskLevel: 'L0_READ',
  allowedCapabilities: ['crm.account.get_context', 'crm.timeline.get_events'],
  forbiddenCapabilities: ['crm.deal.advance_stage'],
  expectedIntermediateActions: ['crm.account.get_context'],
  expectedFinalState: {},
  expectedEvidenceKeys: ['gis_acv_evidence'],
  expectedOutputContains: ['Ghana International School', '$180,000'],
  adversarialDirectives: [],
  humanBaseline: {
    humanTimeSeconds: 900,
    humanErrorRate: 7.5,
    humanSourcesConsulted: 4,
    totalSourcesAvailable: 8,
  },
};

describe('Phase 15 Milestone 1: ContinuousEvaluationEngine', () => {
  let engine: ContinuousEvaluationEngine;

  beforeEach(() => {
    vi.restoreAllMocks();
    engine = new ContinuousEvaluationEngine();
    engine.clearHistory();
  });

  it('executes evaluation cleanly and satisfies Rule 42 sandboxing invariants', async () => {
    const run = await engine.evaluateScenario({
      scenario: mockScenario,
      personaId: 'crm_researcher',
      executedBy: 'usr_admin',
      trace: {
        outputText: 'Account brief for Ghana International School: ACV is $180,000 [gis_acv_evidence].',
        isSuccess: true,
        calledCapabilities: ['crm.account.get_context'],
        highestRiskLevelInvoked: 'L0_READ',
        accessedOrganizationIds: ['org_test'],
        accessedWorkspaceIds: ['ws_edu'],
        heldPermissions: ['crm:read'],
        attemptedNonDelegableActions: [],
        citedEvidenceKeys: ['gis_acv_evidence'],
        liveWritesAttempted: 0,
      },
    });

    expect(run.status).toBe('SUCCESS');
    expect(run.overallScore).toBeGreaterThanOrEqual(90);
    expect(run.dryRun).toBe(true);
    expect(run.liveWritesCount).toBe(0);
    expect(run.auditHash).toHaveLength(64);
  });

  it('enforces Rule 42 critical stop: throws EVALUATION_LIVE_WRITE_FORBIDDEN on attempted writes', async () => {
    await expect(
      engine.evaluateScenario({
        scenario: mockScenario,
        personaId: 'crm_researcher',
        executedBy: 'usr_admin',
        trace: {
          outputText: 'Mutated state',
          isSuccess: true,
          calledCapabilities: ['crm.account.get_context'],
          highestRiskLevelInvoked: 'L2_STATE_MUTATION',
          accessedOrganizationIds: ['org_test'],
          accessedWorkspaceIds: ['ws_edu'],
          heldPermissions: ['crm:read'],
          attemptedNonDelegableActions: [],
          liveWritesAttempted: 1, // Rule 42 write violation
        },
      })
    ).rejects.toThrow(/Rule 42 Violation: Live database write attempted/);
  });

  it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValueOnce(
      new Error('Emergency Dead-Man Switch is Active')
    );

    await expect(
      engine.evaluateScenario({
        scenario: mockScenario,
        personaId: 'crm_researcher',
        executedBy: 'usr_admin',
        trace: {
          outputText: 'Sample output',
          isSuccess: true,
          calledCapabilities: ['crm.account.get_context'],
          highestRiskLevelInvoked: 'L0_READ',
          accessedOrganizationIds: ['org_test'],
          accessedWorkspaceIds: ['ws_edu'],
          heldPermissions: ['crm:read'],
          attemptedNonDelegableActions: [],
          liveWritesAttempted: 0,
        },
      })
    ).rejects.toThrow(/Governance emergency dead-man switch is active/);
  });

  it('supports cooperative cancellation via AbortSignal (Rule 26)', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      engine.evaluateScenario({
        scenario: mockScenario,
        personaId: 'crm_researcher',
        executedBy: 'usr_admin',
        trace: {
          outputText: 'Aborted output',
          isSuccess: true,
          calledCapabilities: ['crm.account.get_context'],
          highestRiskLevelInvoked: 'L0_READ',
          accessedOrganizationIds: ['org_test'],
          accessedWorkspaceIds: ['ws_edu'],
          heldPermissions: ['crm:read'],
          attemptedNonDelegableActions: [],
          liveWritesAttempted: 0,
        },
        signal: controller.signal,
      })
    ).rejects.toThrow(/Evaluation run aborted/);
  });

  it('emits evaluation.run.completed event to defaultEventBus', async () => {
    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    await engine.evaluateScenario({
      scenario: mockScenario,
      personaId: 'crm_researcher',
      executedBy: 'usr_admin',
      trace: {
        outputText: 'Brief for Ghana International School: $180,000.',
        isSuccess: true,
        calledCapabilities: ['crm.account.get_context'],
        highestRiskLevelInvoked: 'L0_READ',
        accessedOrganizationIds: ['org_test'],
        accessedWorkspaceIds: ['ws_edu'],
        heldPermissions: ['crm:read'],
        attemptedNonDelegableActions: [],
        citedEvidenceKeys: ['gis_acv_evidence'],
        liveWritesAttempted: 0,
      },
    });

    expect(publishSpy).toHaveBeenCalled();
    const eventArg = publishSpy.mock.calls[0]?.[0];
    expect(eventArg.type).toBe('evaluation.run.completed');
  });

  it('aggregates domain benchmark summaries accurately', async () => {
    await engine.evaluateScenario({
      scenario: mockScenario,
      personaId: 'crm_researcher',
      executedBy: 'usr_admin',
      trace: {
        outputText: 'Ghana International School brief with $180,000.',
        isSuccess: true,
        calledCapabilities: ['crm.account.get_context'],
        highestRiskLevelInvoked: 'L0_READ',
        accessedOrganizationIds: ['org_test'],
        accessedWorkspaceIds: ['ws_edu'],
        heldPermissions: ['crm:read'],
        attemptedNonDelegableActions: [],
        citedEvidenceKeys: ['gis_acv_evidence'],
        liveWritesAttempted: 0,
        durationMs: 1200,
      },
    });

    const summary = engine.getBenchmarkSummary('crm');
    expect(summary.domain).toBe('crm');
    expect(summary.scenarioCount).toBe(1);
    expect(summary.passRate).toBe(100);
    expect(summary.avgDurationMs).toBe(1200);
  });

  it('preserves global singleton via getContinuousEvaluationEngine()', () => {
    const instance1 = getContinuousEvaluationEngine();
    const instance2 = getContinuousEvaluationEngine();
    expect(instance1).toBe(instance2);
  });
});
