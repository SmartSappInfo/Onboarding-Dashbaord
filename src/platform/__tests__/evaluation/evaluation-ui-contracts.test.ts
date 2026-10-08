/**
 * @fileOverview Unit Tests for Evaluation UI Contracts & 4 Governance Matrices (Phase 15 Milestone 5)
 */

import { describe, it, expect } from 'vitest';
import {
  EVALUATION_VIEW_TABS,
  EvaluationViewTabSchema,
  AgentQualityKPIsSchema,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  EvaluationIncidentTicketSchema,
  CreateIncidentInputSchema,
  ResolveIncidentInputSchema,
  BenchmarkRunSummarySchema,
  RegressionTrendPointSchema,
  FailureSummaryRecordSchema,
  HumanCorrectionRecordSchema,
  EVALUATION_UI_ERROR_CODES,
  EvaluationUiError,
  EVALUATION_UI_PERMISSION_MATRIX,
  EVALUATION_UI_TOOL_MATRIX,
  EVALUATION_UI_FAILURE_MATRIX,
  EVALUATION_UI_ROLLBACK_MATRIX,
} from '../../evaluation/ui/evaluation-ui-types';

describe('Phase 15 Milestone 5 - Evaluation UI Contracts & Matrices', () => {
  it('validates 7 canonical evaluation view tabs adhering to agents_mcp_ui.md', () => {
    expect(EVALUATION_VIEW_TABS).toHaveLength(7);
    expect(EVALUATION_VIEW_TABS).toContain('benchmarks');
    expect(EVALUATION_VIEW_TABS).toContain('regression');
    expect(EVALUATION_VIEW_TABS).toContain('production_quality');
    expect(EVALUATION_VIEW_TABS).toContain('failures');
    expect(EVALUATION_VIEW_TABS).toContain('human_corrections');
    expect(EVALUATION_VIEW_TABS).toContain('cost_tokens');
    expect(EVALUATION_VIEW_TABS).toContain('latency_performance');

    for (const tab of EVALUATION_VIEW_TABS) {
      expect(EvaluationViewTabSchema.safeParse(tab).success).toBe(true);
    }
    expect(EvaluationViewTabSchema.safeParse('invalid_tab').success).toBe(false);
  });

  it('validates 5-part Agent Quality KPIs schema with target boundaries', () => {
    const validKPIs = {
      taskSuccessRate: 96.2,
      toolCorrectnessRate: 98.7,
      policyViolationsCount: 0,
      humanCorrectionRate: 4.8,
      medianRuntimeSeconds: 18,
      totalRunsEvaluated: 1420,
      activePersonasCount: 26,
    };
    const parsed = AgentQualityKPIsSchema.safeParse(validKPIs);
    expect(parsed.success).toBe(true);

    // Negative boundary checks
    expect(AgentQualityKPIsSchema.safeParse({ ...validKPIs, taskSuccessRate: 105 }).success).toBe(false);
    expect(AgentQualityKPIsSchema.safeParse({ ...validKPIs, policyViolationsCount: -1 }).success).toBe(false);
    expect(AgentQualityKPIsSchema.safeParse({ ...validKPIs, humanCorrectionRate: -2 }).success).toBe(false);
  });

  it('validates Incident Management schemas and mandatory >= 5 char justification (Rule 61)', () => {
    expect(INCIDENT_SEVERITIES).toContain('P0_CRITICAL');
    expect(INCIDENT_STATUSES).toContain('OPEN');

    const validCreate = {
      organizationId: 'org_123',
      title: 'Model Routing Degradation',
      severity: 'P1_HIGH',
      personaId: 'sdr_agent',
      capabilityId: 'sales.send_outreach',
      justification: 'Error rate increased above 5% in the last 15 minutes',
    };
    expect(CreateIncidentInputSchema.safeParse(validCreate).success).toBe(true);

    // Rejects justification < 5 chars
    const shortJustification = {
      ...validCreate,
      justification: 'bad',
    };
    const shortResult = CreateIncidentInputSchema.safeParse(shortJustification);
    expect(shortResult.success).toBe(false);

    // Ticket parsing
    const validTicket = {
      ...validCreate,
      id: 'inc_abc123',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorUserId: 'user_456',
    };
    expect(EvaluationIncidentTicketSchema.safeParse(validTicket).success).toBe(true);

    // Resolve incident requires >= 5 char notes
    expect(ResolveIncidentInputSchema.safeParse({
      incidentId: 'inc_abc123',
      organizationId: 'org_123',
      resolutionNotes: 'Fixed gateway connection and verified latency drop',
    }).success).toBe(true);

    expect(ResolveIncidentInputSchema.safeParse({
      incidentId: 'inc_abc123',
      organizationId: 'org_123',
      resolutionNotes: 'done',
    }).success).toBe(false);
  });

  it('validates 7-view data schemas (BenchmarkRun, Regression, Failure, Correction, Cost, Latency)', () => {
    const validRun = {
      id: 'run_123',
      scenarioId: 'crm_eval_01',
      domain: 'crm',
      personaId: 'deal_intelligence_agent',
      score: 95.5,
      passed: true,
      durationMs: 1250,
      tokensUsed: 840,
      estimatedCostUsd: 0.0042,
      timestamp: new Date().toISOString(),
    };
    expect(BenchmarkRunSummarySchema.safeParse(validRun).success).toBe(true);

    const validRegression = {
      timestamp: new Date().toISOString(),
      commitSha: '589dffa3',
      taskSuccessRate: 96.5,
      toolCorrectnessRate: 98.9,
      benchmarkScore: 94.2,
    };
    expect(RegressionTrendPointSchema.safeParse(validRegression).success).toBe(true);

    const validFailure = {
      id: 'fail_1',
      scenarioId: 'finance_eval_02',
      personaId: 'reconciliation_agent',
      domain: 'finance',
      errorCode: 'RECONCILIATION_DISCREPANCY',
      failureStrategy: 'TRIGGER_REVERSE_LIFO_SAGA',
      rootCause: 'Ledger discrepancy detected between bank and invoice',
      timestamp: new Date().toISOString(),
    };
    expect(FailureSummaryRecordSchema.safeParse(validFailure).success).toBe(true);

    const validCorrection = {
      id: 'corr_1',
      proposalId: 'prop_999',
      personaId: 'billing_specialist',
      domain: 'finance',
      actionType: 'finance.create_installment_plan',
      originalPayloadSummary: '5 milestones @ $200',
      correctedPayloadSummary: '4 milestones @ $250',
      rejectionReason: 'Parent requested shorter 4-month plan',
      timestamp: new Date().toISOString(),
      reviewedByUserId: 'user_operator_1',
    };
    expect(HumanCorrectionRecordSchema.safeParse(validCorrection).success).toBe(true);
  });

  it('validates structured error taxonomy & EvaluationUiError class (Rule 48)', () => {
    const err = new EvaluationUiError(
      EVALUATION_UI_ERROR_CODES.DEAD_MAN_PAUSED,
      'Evaluation paused by emergency switch',
      503
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EvaluationUiError');
    expect(err.code).toBe('EVALUATION_UI_DEAD_MAN_PAUSED');
    expect(err.httpStatus).toBe(503);
  });

  it('validates the 4 Mandatory Governance Matrices (Rules 1940–1953)', () => {
    // 1. Permission Matrix
    expect(EVALUATION_UI_PERMISSION_MATRIX.admin_user).toContain('intelligence:evaluation:manage');
    expect(EVALUATION_UI_PERMISSION_MATRIX.all_agent_personas).not.toContain('intelligence:evaluation:manage');

    // 2. Tool Matrix: Mutating tools are non-delegable and require audit
    expect(EVALUATION_UI_TOOL_MATRIX['evaluation.ui.create_incident'].isDelegable).toBe(false);
    expect(EVALUATION_UI_TOOL_MATRIX['evaluation.ui.create_incident'].auditRequired).toBe(true);
    expect(EVALUATION_UI_TOOL_MATRIX['evaluation.ui.get_telemetry'].isDelegable).toBe(true);

    // 3. Failure Matrix
    expect(EVALUATION_UI_FAILURE_MATRIX.EVALUATION_UI_DEAD_MAN_PAUSED.httpStatus).toBe(503);
    expect(EVALUATION_UI_FAILURE_MATRIX.EVALUATION_UI_DEAD_MAN_PAUSED.strategy).toBe('FAIL_CLOSED');
    expect(EVALUATION_UI_FAILURE_MATRIX.EVALUATION_UI_IDOR_VIOLATION.httpStatus).toBe(403);

    // 4. Rollback Matrix
    expect(EVALUATION_UI_ROLLBACK_MATRIX['evaluation.ui.create_incident']).toBe('evaluation.ui.cancel_incident');
    expect(EVALUATION_UI_ROLLBACK_MATRIX['evaluation.ui.get_telemetry']).toBeNull();
  });
});
