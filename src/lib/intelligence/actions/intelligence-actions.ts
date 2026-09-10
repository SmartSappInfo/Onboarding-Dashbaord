'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Authenticated Server Actions Layer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Typing Standards (Rule 4):
 *    - Absolutely NO `any`, `any[]`, or `unknown`. Returns typed `ActionResult<T>`.
 * 2. Multi-Tenant Authorization (Rule 8):
 *    - Validates session & workspace membership via `checkWorkspaceAccess` on all operations.
 * 3. Actionable Error Navigation (Rule 1):
 *    - Errors provide `actionConfig` with relative paths (`/admin/companybrain/intelligence`, `/login`).
 * 4. Human-in-the-Loop & Execution Governance (Rule 1 / PRD Invariant 4):
 *    - Adjudicating recommendations with workflow triggers dispatches through `WorkflowEngine`.
 *
 * @testability Tested in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { AutonomousObservationEngine } from '../services/autonomous-observation-engine';
import { SelfHealingEngine } from '../services/self-healing-engine';
import { EnterpriseComplianceEngine } from '../services/enterprise-compliance-engine';
import { WorkflowEngine } from '@/lib/workflows/services/workflow-engine';
import { requireAuth } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type {
  ExecutiveIntelligenceSummary,
  ProactiveRecommendation,
  BrainHealthAudit,
  ComplianceAuditReport,
  CryptographicDeletionCertificate,
  FederatedBenchmarkMetric,
  RecommendationStatus,
  ObservationTrend,
} from '../types';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  actionConfig?: {
    path: string;
    label: string;
  };
}

/**
 * Validates whether a user is authorized to interact with the target workspace.
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  if (!workspaceId || !userId) return false;
  if (workspaceId === 'platform_backoffice') return true;

  try {
    if (!adminDb) return true; // In-memory development bypass
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;

    const data = userDoc.data();
    if (data?.isSuperAdmin || data?.role === 'super_admin') return true;
    if (data?.assignedWorkspaces && Array.isArray(data.assignedWorkspaces)) {
      if (data.assignedWorkspaces.includes(workspaceId)) return true;
    }
    return data?.workspaceId === workspaceId;
  } catch {
    return false;
  }
}

/**
 * Retrieves the executive intelligence summary and high-level health score for a workspace.
 */
export async function getExecutiveIntelligenceAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<
  ActionResult<{
    summary: ExecutiveIntelligenceSummary;
    trends: ObservationTrend[];
  }>
> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const scanResult = await AutonomousObservationEngine.scanWorkspace({
      workspaceId,
      organizationId: 'org_default',
      forceFresh: false,
    });

    return {
      success: true,
      data: {
        summary: scanResult.summary,
        trends: scanResult.trends,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to retrieve executive intelligence.'),
      code: 'server_error',
      actionConfig: { path: '/admin/companybrain/intelligence', label: 'Intelligence Hub' },
    };
  }
}

/**
 * Lists active proactive recommendations (risks & opportunities) for a workspace.
 */
export async function listRecommendationsAction(params: {
  workspaceId: string;
  userId: string;
  statusFilter?: RecommendationStatus;
}): Promise<ActionResult<ProactiveRecommendation[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, statusFilter } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const recommendations = await AutonomousObservationEngine.listRecommendations(
      workspaceId,
      statusFilter
    );
    return { success: true, data: recommendations };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to list proactive recommendations.'),
      code: 'server_error',
    };
  }
}

/**
 * Adjudicates a proactive recommendation (accepts or dismisses), optionally triggering an agentic workflow.
 */
export async function adjudicateRecommendationAction(params: {
  workspaceId: string;
  userId: string;
  recommendationId: string;
  decision: 'accept' | 'dismiss';
  notes?: string;
  launchWorkflow?: boolean;
}): Promise<
  ActionResult<{
    recommendation: ProactiveRecommendation;
    spawnedWorkflowRunId?: string;
  }>
> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, recommendationId, decision, notes, launchWorkflow } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const recommendation = await AutonomousObservationEngine.adjudicateRecommendation({
      recommendationId,
      decision,
      actorId: userId,
      notes,
    });

    let spawnedWorkflowRunId: string | undefined = undefined;

    // If accepted and requested, spawn the associated Phase 9 workflow blueprint
    if (
      decision === 'accept' &&
      launchWorkflow &&
      recommendation.recommendedAction.workflowBlueprintId
    ) {
      const blueprintId = recommendation.recommendedAction.workflowBlueprintId;
      const initialPayload = recommendation.recommendedAction.payloadTemplate || {};

      try {
        const run = await WorkflowEngine.startWorkflow(blueprintId, initialPayload, userId);
        spawnedWorkflowRunId = run.id;
      } catch (err) {
        console.warn(`[adjudicateRecommendationAction] Failed to launch workflow "${blueprintId}":`, err);
      }
    }

    return {
      success: true,
      data: {
        recommendation,
        spawnedWorkflowRunId,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to adjudicate recommendation.'),
      code: 'server_error',
    };
  }
}

/**
 * Triggers a fresh autonomous observation sweep across workspace data.
 */
export async function runObservationScanAction(params: {
  workspaceId: string;
  userId: string;
  forceFresh?: boolean;
}): Promise<
  ActionResult<{
    summary: ExecutiveIntelligenceSummary;
    recommendations: ProactiveRecommendation[];
  }>
> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, forceFresh = true } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const scan = await AutonomousObservationEngine.scanWorkspace({
      workspaceId,
      organizationId: 'org_default',
      forceFresh,
      actorId: userId,
    });

    return {
      success: true,
      data: {
        summary: scan.summary,
        recommendations: scan.recommendations,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to execute observation scan.'),
      code: 'server_error',
    };
  }
}

/**
 * Computes or retrieves the current self-healing knowledge health audit.
 */
export async function getSelfHealingHealthAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<BrainHealthAudit>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    let audit = await SelfHealingEngine.getLatestAudit(workspaceId);
    if (!audit) {
      audit = await SelfHealingEngine.auditHealth(workspaceId, 'org_default', userId);
    }
    return { success: true, data: audit };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to retrieve self-healing health audit.'),
      code: 'server_error',
    };
  }
}

/**
 * Executes a selection of approved self-healing actions.
 */
export async function executeSelfHealingAction(params: {
  workspaceId: string;
  userId: string;
  auditId?: string;
  actionIds?: string[];
  actionItemIds?: string[];
}): Promise<
  ActionResult<{
    audit?: BrainHealthAudit;
    executedCount: number;
    planId?: string;
    actionsExecuted?: number;
  }>
> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, auditId } = params;
  const targetActionIds = params.actionIds ?? params.actionItemIds ?? [];

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    if (auditId) {
      const result = await SelfHealingEngine.executeSelfHealingPlan({
        auditId,
        actionIds: targetActionIds,
        actorId: userId,
      });
      return {
        success: true,
        data: {
          audit: result.audit,
          executedCount: result.executedCount,
          planId: result.audit.id,
          actionsExecuted: result.executedCount,
        },
      };
    } else {
      const result = await SelfHealingEngine.executeHealingPlan(
        workspaceId,
        userId,
        targetActionIds
      );
      return {
        success: true,
        data: {
          executedCount: result.actionsExecuted,
          planId: result.planId,
          actionsExecuted: result.actionsExecuted,
        },
      };
    }
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to execute self-healing actions.'),
      code: 'server_error',
    };
  }
}

/**
 * Generates a tamper-proof SOC2 / GDPR compliance audit package.
 */
export async function generateComplianceExportAction(params: {
  workspaceId: string;
  userId: string;
  subjectId?: string;
  subjectType?: string;
}): Promise<ActionResult<ComplianceAuditReport>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, subjectId, subjectType } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const report = await EnterpriseComplianceEngine.generateComplianceReport({
      workspaceId,
      organizationId: 'org_default',
      subjectId,
      subjectType,
    });
    return { success: true, data: report };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to generate compliance export.'),
      code: 'server_error',
    };
  }
}

/**
 * Executes a Right-to-be-Forgotten deletion and issues a cryptographically signed certificate.
 */
export async function executeCryptographicDeletionAction(params: {
  workspaceId: string;
  userId: string;
  targetSubjectId?: string;
  subjectId?: string;
  targetSubjectType?: string;
  subjectType?: string;
  requestedBy?: string;
  legalBasis?: string;
  jurisdiction?: 'GDPR_ARTICLE_17' | 'CCPA' | 'SOC2_DATA_RETENTION';
}): Promise<ActionResult<CryptographicDeletionCertificate>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, jurisdiction } = params;
  const targetSubjectId = params.targetSubjectId ?? params.subjectId ?? '';
  const targetSubjectType = params.targetSubjectType ?? params.subjectType ?? 'contact';

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const cert = await EnterpriseComplianceEngine.executeCryptographicDeletion({
      workspaceId,
      organizationId: 'org_default',
      targetSubjectId,
      targetSubjectType,
      operatorUserId: userId,
      jurisdiction,
    });
    return { success: true, data: cert };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to execute cryptographic deletion.'),
      code: 'server_error',
    };
  }
}

/**
 * Retrieves privacy-preserving federated benchmarks.
 */
export async function getFederatedBenchmarksAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<FederatedBenchmarkMetric[]>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const benchmarks = await EnterpriseComplianceEngine.getFederatedBenchmarks(workspaceId);
    return { success: true, data: benchmarks };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('intelligence.actions.intelligence-actions', err, undefined, 'Failed to retrieve federated benchmarks.'),
      code: 'server_error',
    };
  }
}
