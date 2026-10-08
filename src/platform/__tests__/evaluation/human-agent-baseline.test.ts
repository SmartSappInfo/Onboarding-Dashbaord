/**
 * @fileOverview Human Baseline vs Agent Baseline Benchmarking Engine Test Suite (Phase 15 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  HumanAgentBaselineService,
  getHumanAgentBaselineService,
} from '../../evaluation/benchmarks/human-agent-baseline-service';
import {
  EvaluationScenario,
  EvaluationRun,
} from '../../evaluation/contracts/evaluation-types';

const mockScenario: EvaluationScenario = {
  id: 'eval_crm_01',
  domain: 'crm',
  category: 'Account 360',
  title: 'Flagship Account Brief',
  description: 'Account brief',
  inputQuery: 'Brief for Ghana International School',
  entityId: 'ent_gis_001',
  workspaceId: 'ws_edu',
  organizationId: 'org_test',
  groundTruthFacts: ['ACV $180,000'],
  expectedPersona: 'crm_researcher',
  expectedRiskLevel: 'L0_READ',
  allowedCapabilities: ['crm.account.get_context'],
  forbiddenCapabilities: [],
  expectedIntermediateActions: [],
  expectedFinalState: {},
  expectedEvidenceKeys: [],
  expectedOutputContains: ['Ghana International School'],
  adversarialDirectives: [],
  humanBaseline: {
    humanTimeSeconds: 900, // 15 minutes
    humanErrorRate: 8.0, // 8% error rate
    humanSourcesConsulted: 4,
    totalSourcesAvailable: 8,
  },
};

const mockRun: EvaluationRun = {
  id: 'eval_run_01',
  scenarioId: 'eval_crm_01',
  personaId: 'crm_researcher',
  domain: 'crm',
  status: 'SUCCESS',
  overallScore: 95,
  durationMs: 2000, // 2 seconds
  dryRun: true,
  liveWritesCount: 0,
  toolCallsCount: 2,
  unnecessaryToolCallsCount: 0,
  costMicroUSD: 400,
  promptTokens: 800,
  completionTokens: 200,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  executedBy: 'usr_admin',
  metricScores: [],
  failureReasons: [],
  auditHash: 'a'.repeat(64),
};

describe('Phase 15 Milestone 1: HumanAgentBaselineService', () => {
  const service = new HumanAgentBaselineService();

  it('computes speedup, error reduction, and context breadth metrics deterministically', () => {
    const comparison = service.computeComparison({
      scenario: mockScenario,
      run: mockRun,
      agentSourcesConsulted: 8,
    });

    expect(comparison.scenarioId).toBe('eval_crm_01');
    expect(comparison.domain).toBe('crm');
    // Human: 900s, Agent: 2.0s -> Speedup: 450x
    expect(comparison.speedupFactor).toBe(450);
    // Human: 8.0%, Agent: 0.5% -> Error reduction: 93.75%
    expect(comparison.errorReductionPercentage).toBe(93.75);
    // Human: 4 sources, Agent: 8 sources -> Context breadth factor: 2.0x
    expect(comparison.contextBreadthFactor).toBe(2);
  });

  it('handles degraded runs with proportional error rate penalty', () => {
    const degradedRun: EvaluationRun = {
      ...mockRun,
      status: 'DEGRADED',
      overallScore: 70, // 30% gap
    };

    const comparison = service.computeComparison({
      scenario: mockScenario,
      run: degradedRun,
      agentSourcesConsulted: 6,
    });

    expect(comparison.agentErrorRate).toBe(30);
    expect(comparison.errorReductionPercentage).toBeLessThan(0); // Agent had higher error rate than human baseline
  });

  it('aggregates domain comparisons accurately', () => {
    const comparison1 = service.computeComparison({
      scenario: mockScenario,
      run: mockRun,
      agentSourcesConsulted: 8,
    });

    const comparison2 = service.computeComparison({
      scenario: {
        ...mockScenario,
        id: 'eval_crm_02',
        humanBaseline: {
          humanTimeSeconds: 600,
          humanErrorRate: 10.0,
          humanSourcesConsulted: 3,
          totalSourcesAvailable: 6,
        },
      },
      run: {
        ...mockRun,
        id: 'eval_run_02',
        scenarioId: 'eval_crm_02',
        durationMs: 3000, // 3 seconds -> 200x speedup
      },
      agentSourcesConsulted: 6, // 2x breadth
    });

    const aggregate = service.aggregateDomainBaselines('crm', [comparison1, comparison2]);

    expect(aggregate.domain).toBe('crm');
    expect(aggregate.scenarioCount).toBe(2);
    expect(aggregate.avgSpeedupFactor).toBe((450 + 200) / 2); // 325
    expect(aggregate.avgContextBreadthFactor).toBe(2);
  });

  it('guards against division by zero with epsilon', () => {
    const zeroTimeScenario: EvaluationScenario = {
      ...mockScenario,
      humanBaseline: {
        humanTimeSeconds: 1,
        humanErrorRate: 0.1,
        humanSourcesConsulted: 1,
        totalSourcesAvailable: 1,
      },
    };

    const comparison = service.computeComparison({
      scenario: zeroTimeScenario,
      run: { ...mockRun, durationMs: 0 },
    });

    expect(Number.isFinite(comparison.speedupFactor)).toBe(true);
    expect(Number.isFinite(comparison.errorReductionPercentage)).toBe(true);
    expect(Number.isFinite(comparison.contextBreadthFactor)).toBe(true);
  });

  it('preserves global singleton via getHumanAgentBaselineService()', () => {
    const instance1 = getHumanAgentBaselineService();
    const instance2 = getHumanAgentBaselineService();
    expect(instance1).toBe(instance2);
  });
});
