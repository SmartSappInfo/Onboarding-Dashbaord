/**
 * @fileOverview Evaluation Contracts & Schemas Test Suite (Phase 15 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  EvaluationDomainSchema,
  EvaluationCategorySchema,
  EvaluationScenarioSchema,
  EvaluationRunSchema,
  BenchmarkComparisonSchema,
  HumanVsAgentBaselineSchema,
  EvaluationBatchRunInputSchema,
  EVALUATION_ERROR_CODES,
  AgentEvaluationError,
  EVALUATION_PERMISSION_MATRIX,
  EVALUATION_TOOL_MATRIX,
  EVALUATION_FAILURE_MATRIX,
  EVALUATION_ROLLBACK_MATRIX,
} from '../../evaluation/contracts/evaluation-types';

describe('Phase 15 Milestone 1: Evaluation Contracts & Schemas', () => {
  it('validates canonical evaluation domains and rejects invalid domains', () => {
    expect(EvaluationDomainSchema.safeParse('crm').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('sales').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('meetings').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('knowledge').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('finance').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('school').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('supervisor').success).toBe(true);
    expect(EvaluationDomainSchema.safeParse('unsupported_domain').success).toBe(false);
  });

  it('validates canonical evaluation metric categories', () => {
    expect(EvaluationCategorySchema.safeParse('TASK_COMPLETION').success).toBe(true);
    expect(EvaluationCategorySchema.safeParse('TOOL_SELECTION').success).toBe(true);
    expect(EvaluationCategorySchema.safeParse('POLICY_CORRECTNESS').success).toBe(true);
    expect(EvaluationCategorySchema.safeParse('EVIDENCE_GROUNDING').success).toBe(true);
    expect(EvaluationCategorySchema.safeParse('INVALID_METRIC').success).toBe(false);
  });

  it('validates a complete EvaluationScenarioSchema', () => {
    const validScenario = {
      id: 'eval_crm_01',
      domain: 'crm',
      category: 'Account 360',
      title: 'Flagship Account 360 Comprehensive Brief',
      description: 'Prepare comprehensive brief',
      inputQuery: 'Prepare account brief for Ghana International School',
      entityId: 'ent_gis_001',
      workspaceId: 'ws_edu',
      organizationId: 'org_test',
      groundTruthFacts: ['ACV is $180k', 'Renewal in 90 days'],
      expectedPersona: 'crm_researcher',
      expectedRiskLevel: 'L0_READ',
      allowedCapabilities: ['crm.account.get_context', 'crm.timeline.get_events'],
      forbiddenCapabilities: ['crm.deal.advance_stage'],
      expectedIntermediateActions: ['crm.account.get_context'],
      expectedFinalState: {},
      expectedEvidenceKeys: ['acv_val'],
      expectedOutputContains: ['Ghana International School', '$180k'],
      adversarialDirectives: [],
      humanBaseline: {
        humanTimeSeconds: 900,
        humanErrorRate: 7.5,
        humanSourcesConsulted: 4,
        totalSourcesAvailable: 8,
      },
    };

    const parsed = EvaluationScenarioSchema.safeParse(validScenario);
    expect(parsed.success).toBe(true);
  });

  it('enforces Rule 42 sandboxing invariants in EvaluationRunSchema', () => {
    const validRun = {
      id: 'eval_run_001',
      scenarioId: 'eval_crm_01',
      personaId: 'crm_researcher',
      domain: 'crm',
      status: 'SUCCESS',
      overallScore: 95.5,
      durationMs: 1420,
      dryRun: true,
      liveWritesCount: 0,
      toolCallsCount: 3,
      unnecessaryToolCallsCount: 0,
      costMicroUSD: 420,
      promptTokens: 850,
      completionTokens: 210,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executedBy: 'usr_admin',
      metricScores: [
        {
          metric: 'TASK_COMPLETION',
          score: 100,
          passed: true,
          weight: 0.3,
          details: 'Goal satisfied',
          violations: [],
        },
      ],
      failureReasons: [],
      auditHash: 'a'.repeat(64),
    };

    expect(EvaluationRunSchema.safeParse(validRun).success).toBe(true);

    // Rule 42 violation: liveWritesCount > 0 must be rejected
    const writeViolationRun = { ...validRun, liveWritesCount: 1 };
    expect(EvaluationRunSchema.safeParse(writeViolationRun).success).toBe(false);

    // Rule 42 violation: dryRun === false must be rejected
    const nonDryRun = { ...validRun, dryRun: false };
    expect(EvaluationRunSchema.safeParse(nonDryRun).success).toBe(false);
  });

  it('validates BenchmarkComparisonSchema and HumanVsAgentBaselineSchema', () => {
    const benchmark = {
      domain: 'crm',
      scenarioCount: 5,
      passRate: 100,
      avgTaskCompletion: 98.2,
      avgToolSelectionAccuracy: 99.0,
      avgGroundingScore: 96.5,
      totalCostMicroUSD: 2100,
      avgDurationMs: 1650,
    };
    expect(BenchmarkComparisonSchema.safeParse(benchmark).success).toBe(true);

    const baseline = {
      scenarioId: 'eval_crm_01',
      domain: 'crm',
      humanTimeSeconds: 900,
      agentTimeSeconds: 120,
      speedupFactor: 7.5,
      humanErrorRate: 8.0,
      agentErrorRate: 1.1,
      errorReductionPercentage: 86.25,
      humanSourcesConsulted: 4,
      agentSourcesConsulted: 8,
      contextBreadthFactor: 2.0,
    };
    expect(HumanVsAgentBaselineSchema.safeParse(baseline).success).toBe(true);

    const batchInput = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      domain: 'crm' as const,
      dryRun: true,
    };
    expect(EvaluationBatchRunInputSchema.safeParse(batchInput).success).toBe(true);
  });

  it('validates AgentEvaluationError and structured taxonomy', () => {
    const error = new AgentEvaluationError(
      EVALUATION_ERROR_CODES.EVALUATION_LIVE_WRITE_FORBIDDEN,
      'Live write attempted in evaluation sandboxing',
      403
    );
    expect(error.code).toBe('EVALUATION_LIVE_WRITE_FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toContain('Live write attempted');
  });

  it('verifies the 4 Governance Matrices structure and content', () => {
    // 1. Permission Matrix
    expect(EVALUATION_PERMISSION_MATRIX.admin_user).toContain('evaluation:manage');
    expect(EVALUATION_PERMISSION_MATRIX.evaluator_agent).toContain('evaluation:read');
    expect(EVALUATION_PERMISSION_MATRIX.evaluator_agent).not.toContain('evaluation:manage');

    // 2. Tool Matrix
    expect(EVALUATION_TOOL_MATRIX['evaluation.run_scenario'].level).toBe('L0_READ');
    expect(EVALUATION_TOOL_MATRIX['evaluation.run_scenario'].isIdempotent).toBe(true);

    // 3. Failure Matrix
    expect(EVALUATION_FAILURE_MATRIX.EVALUATION_LIVE_WRITE_FORBIDDEN).toBe('FAIL_CLOSED');
    expect(EVALUATION_FAILURE_MATRIX.EVALUATION_DEAD_MAN_PAUSED).toBe('FAIL_CLOSED');
    expect(EVALUATION_FAILURE_MATRIX.EVALUATION_TIMEOUT).toBe('DEGRADE_GRACEFULLY');

    // 4. Rollback Matrix
    expect(EVALUATION_ROLLBACK_MATRIX['evaluation.run_scenario']).toBe(
      'evaluation.run.noop_compensation'
    );
  });
});
