/**
 * @fileOverview Unit & Security Tests for Evaluation UI Server Actions (Phase 15 Milestone 5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEvaluationDashboardTelemetryAction,
  listBenchmarkRunsAction,
  getBenchmarkRunDetailAction,
  triggerGoldStandardRunAction,
  createIncidentTicketAction,
  resolveIncidentTicketAction,
  toggleEmergencyDeadManAction,
  getEvaluationViewDataAction,
} from '@/app/actions/evaluation-ui-actions';
import { EVALUATION_UI_ERROR_CODES } from '@/platform/evaluation/ui/evaluation-ui-types';

import type { AuthContext } from '@/lib/auth/require-auth';

// Mock auth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

// Mock dead-man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
  AgentGovernanceEmergencyPausedError: class AgentGovernanceEmergencyPausedError extends Error {
    constructor() {
      super('Emergency dead-man switch active');
      this.name = 'AgentGovernanceEmergencyPausedError';
    }
  },
}));

import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } from '@/platform/policy/governance-dead-man';

describe('Phase 15 Milestone 5 - Governed Evaluation UI Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'user_analyst_01',
      uid: 'user_analyst_01',
      profile: {
        organizationId: 'org_test_123',
        workspaceIds: ['ws_test_01'],
      },
      isSystemAdmin: false,
      actor: { type: 'user' },
    } as unknown as AuthContext);

    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  it('retrieves Zone 1 KPI telemetry with canonical target performance metrics', async () => {
    const res = await getEvaluationDashboardTelemetryAction('org_test_123');

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.kpis.taskSuccessRate).toBeGreaterThanOrEqual(95.0);
    expect(res.data?.kpis.toolCorrectnessRate).toBe(98.7);
    expect(res.data?.kpis.policyViolationsCount).toBe(0);
    expect(res.data?.kpis.humanCorrectionRate).toBe(4.8);
    expect(res.data?.kpis.medianRuntimeSeconds).toBe(18);
    expect(res.data?.humanComparison.humanTimeSeconds).toBe(1020);
    expect(res.data?.humanComparison.agentTimeSeconds).toBe(120);
    expect(res.data?.humanComparison.speedupFactor).toBe(8.5);
  });

  it('rejects cross-tenant requests with IDOR_VIOLATION (Rules 8 & 47)', async () => {
    const res = await getEvaluationDashboardTelemetryAction('org_foreign_456');

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(EVALUATION_UI_ERROR_CODES.IDOR_VIOLATION);
  });

  it('fails closed when emergency dead-man switch is paused (Rule 60)', async () => {
    vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
      new AgentGovernanceEmergencyPausedError()
    );

    const res = await getEvaluationDashboardTelemetryAction('org_test_123');

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(EVALUATION_UI_ERROR_CODES.DEAD_MAN_PAUSED);
  });

  it('lists benchmark runs and applies domain and query filters', async () => {
    const res = await listBenchmarkRunsAction({
      organizationId: 'org_test_123',
      filter: { domain: 'crm' },
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data?.every((r) => r.domain === 'crm')).toBe(true);
  });

  it('fetches run details including explainability grid and XML isolated proofs (Rules 13, 30, 41)', async () => {
    const runsRes = await listBenchmarkRunsAction({ organizationId: 'org_test_123' });
    const firstRun = runsRes.data?.[0];
    expect(firstRun).toBeDefined();

    const detailRes = await getBenchmarkRunDetailAction({
      runId: firstRun!.id,
      organizationId: 'org_test_123',
    });

    expect(detailRes.success).toBe(true);
    const data = detailRes.data as {
      explainabilityGrid: { what: string; why: string; expectedVsActual: string; risk: string };
      untrustedReferenceData: string;
    };
    expect(data.explainabilityGrid.what).toBeDefined();
    expect(data.explainabilityGrid.why).toBeDefined();
    expect(data.untrustedReferenceData).toContain('<untrusted_reference_data');
  });

  it('enforces >= 5 characters on incident creation justification (Rule 61)', async () => {
    // Too short
    const shortRes = await createIncidentTicketAction({
      organizationId: 'org_test_123',
      title: 'Drift detected in tool schema',
      severity: 'P1_HIGH',
      justification: 'bad',
    });
    expect(shortRes.success).toBe(false);
    expect(shortRes.error?.code).toBe(EVALUATION_UI_ERROR_CODES.JUSTIFICATION_TOO_SHORT);

    // Valid >= 5 characters
    const validRes = await createIncidentTicketAction({
      organizationId: 'org_test_123',
      title: 'Drift detected in tool schema',
      severity: 'P1_HIGH',
      justification: 'Discovered unexpected payload schema delta during benchmark run',
    });
    expect(validRes.success).toBe(true);
    expect(validRes.data?.id).toBeDefined();
    expect(validRes.data?.status).toBe('OPEN');
  });

  it('enforces resolution notes >= 5 chars on incident resolution (Rule 61)', async () => {
    const ticketRes = await createIncidentTicketAction({
      organizationId: 'org_test_123',
      title: 'Drift detected in tool schema',
      severity: 'P2_MEDIUM',
      justification: 'Schema divergence detected on test sandbox',
    });
    const ticketId = ticketRes.data!.id;

    const shortResolve = await resolveIncidentTicketAction({
      incidentId: ticketId,
      organizationId: 'org_test_123',
      resolutionNotes: 'done',
    });
    expect(shortResolve.success).toBe(false);
    expect(shortResolve.error?.code).toBe(EVALUATION_UI_ERROR_CODES.JUSTIFICATION_TOO_SHORT);

    const validResolve = await resolveIncidentTicketAction({
      incidentId: ticketId,
      organizationId: 'org_test_123',
      resolutionNotes: 'Re-synchronized schema hash with canonical definition',
    });
    expect(validResolve.success).toBe(true);
    expect(validResolve.data?.status).toBe('RESOLVED');
    expect(validResolve.data?.resolvedAt).toBeDefined();
  });

  it('strictly enforces Rule 17 (human-only) for toggling dead-man switches', async () => {
    // Subagent attempt
    vi.mocked(requireAuth).mockResolvedValueOnce({
      userId: 'subagent_bot_99',
      profile: { organizationId: 'org_test_123' },
      isSystemAdmin: false,
      actor: { type: 'agent' },
    } as unknown as AuthContext);

    const botAttempt = await toggleEmergencyDeadManAction({
      organizationId: 'org_test_123',
      switchName: 'agent_execution_paused',
      state: true,
      justification: 'Attempting to toggle kill switch as subagent',
    });
    expect(botAttempt.success).toBe(false);
    expect(botAttempt.error?.code).toBe(EVALUATION_UI_ERROR_CODES.UNAUTHORIZED);

    // Human attempt
    const humanAttempt = await toggleEmergencyDeadManAction({
      organizationId: 'org_test_123',
      switchName: 'agent_execution_paused',
      state: true,
      justification: 'Manual emergency intervention for maintenance window',
    });
    expect(humanAttempt.success).toBe(true);
    expect(humanAttempt.data?.state).toBe(true);
  });

  it('fetches specialized 7-view datasets (Regression, Failures, Human Corrections, Cost, Latency)', async () => {
    const regressionRes = await getEvaluationViewDataAction({
      view: 'regression',
      organizationId: 'org_test_123',
    });
    expect(regressionRes.success).toBe(true);
    expect(Array.isArray(regressionRes.data)).toBe(true);

    const failuresRes = await getEvaluationViewDataAction({
      view: 'failures',
      organizationId: 'org_test_123',
    });
    expect(failuresRes.success).toBe(true);

    const correctionsRes = await getEvaluationViewDataAction({
      view: 'human_corrections',
      organizationId: 'org_test_123',
    });
    expect(correctionsRes.success).toBe(true);

    const costRes = await getEvaluationViewDataAction({
      view: 'cost_tokens',
      organizationId: 'org_test_123',
    });
    expect(costRes.success).toBe(true);

    const latencyRes = await getEvaluationViewDataAction({
      view: 'latency_performance',
      organizationId: 'org_test_123',
    });
    expect(latencyRes.success).toBe(true);
  });
});
