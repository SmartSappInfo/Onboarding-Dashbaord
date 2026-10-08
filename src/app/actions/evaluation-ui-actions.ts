'use server';

/**
 * @fileOverview Governed Evaluation UI Server Actions (Phase 15 Milestone 5)
 *
 * Implements Rules 1, 4, 8, 10, 11, 12, 13, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28,
 * 30, 31, 32, 33, 40, 41, 42, 44, 46, 47, 48, 50, 51, 52, 54, 55, 58, 59, 60, 61, 62, 63, 67, 68, 69.
 *
 * Provides authenticated, Anti-IDOR protected, fail-closed Next.js 15 Server Actions for:
 * - Querying Evaluation Dashboard telemetry and 5-part quality KPIs
 * - Listing paginated benchmark runs and fetching detailed run explainability grids
 * - Triggering deterministic gold-standard benchmarks in dryRun mode (Rule 42)
 * - Backoffice Incident Management & emergency dead-man switch toggles with >= 5 char justifications (Rule 61)
 * - Fetching 7-View specialized datasets (Regression, Quality, Failures, Corrections, Cost, Latency)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  type EvaluationFilterState,
  type EvaluationIncidentTicket,
  type BenchmarkRunSummary,
  type BenchmarkRunDetailData,
  type EvaluationDashboardTelemetry,
  type EvaluationViewTab,
  type IncidentSeverity,
  EVALUATION_UI_ERROR_CODES,
  EvaluationUiError,
  getEvaluationUiService,
} from '@/platform/evaluation/ui';

export interface EvaluationActionResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Asserts authenticated user tenant boundary against target entity (Rules 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, targetOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new EvaluationUiError(
      EVALUATION_UI_ERROR_CODES.IDOR_VIOLATION,
      'Missing authenticated organization context.',
      403
    );
  }

  if (!auth.isSystemAdmin && sessionOrgId !== targetOrgId && targetOrgId !== 'default_org') {
    throw new EvaluationUiError(
      EVALUATION_UI_ERROR_CODES.IDOR_VIOLATION,
      `IDOR Violation: Access denied across organizational boundary (auth: ${sessionOrgId}, target: ${targetOrgId})`,
      403
    );
  }
}

/**
 * Standardized error handler for Server Actions (Rule 48).
 */
function handleError<T>(error: unknown): EvaluationActionResult<T> {
  if (error instanceof AgentGovernanceEmergencyPausedError) {
    return {
      success: false,
      error: {
        code: EVALUATION_UI_ERROR_CODES.DEAD_MAN_PAUSED,
        message: 'Evaluation paused: Backoffice emergency dead-man switch is active (Rule 60).',
      },
    };
  }

  if (error instanceof EvaluationUiError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown evaluation error occurred.';
  return {
    success: false,
    error: {
      code: EVALUATION_UI_ERROR_CODES.EXECUTION_FAILED,
      message,
    },
  };
}

/**
 * 1. Retrieves Evaluation Dashboard Telemetry & Zone 1 Quality KPIs.
 */
export async function getEvaluationDashboardTelemetryAction(
  organizationId?: string
): Promise<EvaluationActionResult<EvaluationDashboardTelemetry>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);

    // Rule 60 Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const telemetry = await service.getDashboardTelemetry(targetOrgId);

    return {
      success: true,
      data: telemetry,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 2. Lists filtered benchmark runs.
 */
export async function listBenchmarkRunsAction(params: {
  organizationId?: string;
  filter?: EvaluationFilterState;
}): Promise<EvaluationActionResult<BenchmarkRunSummary[]>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const runs = await service.listBenchmarkRuns(targetOrgId, params.filter);

    return {
      success: true,
      data: runs,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 3. Retrieves detailed benchmark run report with XML isolated proof data.
 */
export async function getBenchmarkRunDetailAction(params: {
  runId: string;
  organizationId?: string;
}): Promise<EvaluationActionResult<BenchmarkRunDetailData>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const detail = await service.getBenchmarkRunDetail(params.runId, targetOrgId);

    return {
      success: true,
      data: detail,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 4. Triggers execution of a gold-standard benchmark in dryRun mode (Rule 42).
 */
export async function triggerGoldStandardRunAction(params: {
  scenarioId: string;
  organizationId?: string;
}): Promise<EvaluationActionResult<BenchmarkRunSummary>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const actorUserId = auth.uid || (auth as unknown as { userId?: string }).userId || 'system_user';
    const summary = await service.triggerGoldStandardRun(params.scenarioId, targetOrgId, actorUserId);

    return {
      success: true,
      data: summary,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 5. Creates an incident ticket with mandatory >= 5 char justification (Rule 61).
 */
export async function createIncidentTicketAction(params: {
  organizationId?: string;
  title: string;
  severity: IncidentSeverity;
  personaId?: string;
  capabilityId?: string;
  justification: string;
}): Promise<EvaluationActionResult<EvaluationIncidentTicket>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const actorUserId = auth.uid || (auth as unknown as { userId?: string }).userId || 'system_user';
    const ticket = await service.createIncidentTicket(
      {
        organizationId: targetOrgId,
        title: params.title,
        severity: params.severity,
        personaId: params.personaId,
        capabilityId: params.capabilityId,
        justification: params.justification,
      },
      actorUserId
    );

    return {
      success: true,
      data: ticket,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 6. Resolves an incident ticket with mandatory resolution notes (Rule 61).
 */
export async function resolveIncidentTicketAction(params: {
  incidentId: string;
  organizationId?: string;
  resolutionNotes: string;
}): Promise<EvaluationActionResult<EvaluationIncidentTicket>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const actorUserId = auth.uid || (auth as unknown as { userId?: string }).userId || 'system_user';
    const ticket = await service.resolveIncidentTicket(
      {
        incidentId: params.incidentId,
        organizationId: targetOrgId,
        resolutionNotes: params.resolutionNotes,
      },
      actorUserId
    );

    return {
      success: true,
      data: ticket,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 7. Toggles emergency dead-man switches with audited justification note (Rules 60 & 61).
 * Strictly requires human user authority (Rule 17 Non-Delegable Decider).
 */
export async function toggleEmergencyDeadManAction(params: {
  organizationId?: string;
  switchName: string;
  state: boolean;
  justification: string;
}): Promise<EvaluationActionResult<{ success: boolean; switchName: string; state: boolean }>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);

    // Rule 17: Non-Delegable Human Gate check
    const actorType = (auth as unknown as { actor?: { type?: string } }).actor?.type;
    const isHumanUser = !actorType || actorType === 'user';
    if (!isHumanUser && !auth.isSystemAdmin) {
      throw new EvaluationUiError(
        EVALUATION_UI_ERROR_CODES.UNAUTHORIZED,
        'Rule 17 Non-Delegable Decider Violation: Subagents and autonomous bots cannot toggle emergency kill switches.',
        403
      );
    }

    const service = getEvaluationUiService();
    const actorUserId = auth.uid || (auth as unknown as { userId?: string }).userId || 'system_user';
    const result = await service.toggleEmergencyDeadManSwitch(
      targetOrgId,
      params.switchName,
      params.state,
      params.justification,
      actorUserId
    );

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}

/**
 * 8. Fetches view tab datasets for 7 canonical views (agents_mcp_ui.md 3645–3653).
 */
export async function getEvaluationViewDataAction(params: {
  view: EvaluationViewTab;
  organizationId?: string;
  filter?: EvaluationFilterState;
}): Promise<EvaluationActionResult<unknown>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);
    await checkGovernanceDeadManSwitch(targetOrgId);

    const service = getEvaluationUiService();
    const data = await service.getViewData(params.view, targetOrgId, params.filter);

    return {
      success: true,
      data,
    };
  } catch (err: unknown) {
    return handleError(err);
  }
}
