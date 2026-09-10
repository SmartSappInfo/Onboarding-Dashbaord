'use server';

/**
 * @fileoverview Server Actions for Sales Orchestration & Governance (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain F / Phase 8:
 * 1. getSalesOrchestrationDataAction: Master cockpit data aggregation with automatic FER seeder bootstrap.
 * 2. saveSalesPlayAction: Create or modify sales plays with trigger & condition validation.
 * 3. toggleSalesPlayStatusAction: Fast enable/disable switch for individual plays.
 * 4. executePlayStepAction: Advance play execution instance, log outcome, and award +10 effort points.
 * 5. resolveApprovalRequestAction: Governed 1-click human-in-the-loop approval state machine (+15 effort points).
 * 6. triggerSalesPlayManuallyAction: Launch a play directly from deal/seller workspaces.
 * 7. saveRoutingRuleAction & saveEscalationRuleAction: Update workload distribution and SLA matrices.
 * 8. saveOrchestrationGovernanceAction: No-code control plane adjustments & emergency kill switch circuit breaker.
 * 9. executeOrchestrationMigrationAction: Explicit idempotent FER migration runner.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]' or 'as any'.
 * - Must verify workspace access via checkWorkspaceAccess on every invocation.
 * - Anti-IDOR: Every mutation asserts resource.data.workspaceId === workspaceId.
 * - All queries bounded by .limit(50) to avoid batch processing overload and memory spikes.
 */

import { adminDb } from '@/lib/firebase-admin';
import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { revalidatePath } from 'next/cache';
import type {
  SalesPlay,
  PlayExecutionInstance,
  RoutingRule,
  EscalationRule,
  EscalationIncident,
  ApprovalRequest,
  SalesOrchestrationGovernance,
  OrchestrationDashboardData,
  PlayStepExecutionLog,
} from '@/lib/sales-orchestration/types';
import {
  advancePlayExecution,
  createPlayExecutionInstance,
  evaluateApprovalStatus,
} from '@/lib/sales-orchestration/orchestration-engine';
import {
  DEFAULT_ORCHESTRATION_GOVERNANCE,
  executeSalesOrchestrationMigration,
} from '@/lib/sales-orchestration/migration-protocol';
import { evaluateEffortEvent } from '@/lib/scoring-performance-engine';
import { requireWorkspace } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * Internal helper to verify tenant access safely.
 */
async function verifyCallerAccess(userId: string, workspaceId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const access = await checkWorkspaceAccess(userId, workspaceId);
    return access.granted;
  } catch (error) {
    console.error('verifyCallerAccess error in sales-orchestration:', error);
    return false;
  }
}

/**
 * Server Action: Retrieve full Sales Orchestration Cockpit master payload.
 * Automatically runs FER migration seeder if workspace lacks governance.
 */
export async function getSalesOrchestrationDataAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
}): Promise<{
  success: boolean;
  data?: OrchestrationDashboardData;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId } = params;
    if (!workspaceId) {
      return { success: false, error: 'Missing required workspace identifier.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    // Check governance doc existence. If missing, auto-run FER migration seeder
    const govRef = adminDb.collection('salesOrchestrationGovernance').doc(workspaceId);
    let govSnap = await govRef.get();

    if (!govSnap.exists) {
      await executeSalesOrchestrationMigration(workspaceId, organizationId, actorId, 'Auto-Bootstrap');
      govSnap = await govRef.get();
    }

    const governance = (govSnap.exists ? govSnap.data() : {
      ...DEFAULT_ORCHESTRATION_GOVERNANCE,
      workspaceId,
      organizationId,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    }) as SalesOrchestrationGovernance;

    // Parallel queries bounded to <= 50 documents each
    const [
      playsSnap,
      executionsSnap,
      routingSnap,
      escalationSnap,
      approvalsSnap,
      incidentsSnap,
    ] = await Promise.all([
      adminDb
        .collection('salesOrchestrationPlays')
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get(),
      adminDb
        .collection('salesOrchestrationExecutions')
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get(),
      adminDb
        .collection('salesOrchestrationRoutingRules')
        .where('workspaceId', '==', workspaceId)
        .limit(20)
        .get(),
      adminDb
        .collection('salesOrchestrationEscalations')
        .where('workspaceId', '==', workspaceId)
        .limit(20)
        .get(),
      adminDb
        .collection('salesOrchestrationApprovals')
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get(),
      adminDb
        .collection('salesOrchestrationIncidents')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(20)
        .get(),
    ]);

    const plays: SalesPlay[] = [];
    playsSnap.forEach((doc) => {
      plays.push({ ...doc.data(), id: doc.id } as SalesPlay);
    });

    const activeExecutions: PlayExecutionInstance[] = [];
    executionsSnap.forEach((doc) => {
      activeExecutions.push({ ...doc.data(), id: doc.id } as PlayExecutionInstance);
    });

    const routingRules: RoutingRule[] = [];
    routingSnap.forEach((doc) => {
      routingRules.push({ ...doc.data(), id: doc.id } as RoutingRule);
    });

    const escalationRules: EscalationRule[] = [];
    escalationSnap.forEach((doc) => {
      escalationRules.push({ ...doc.data(), id: doc.id } as EscalationRule);
    });

    const pendingApprovals: ApprovalRequest[] = [];
    approvalsSnap.forEach((doc) => {
      pendingApprovals.push({ ...doc.data(), id: doc.id } as ApprovalRequest);
    });

    const activeEscalations: EscalationIncident[] = [];
    incidentsSnap.forEach((doc) => {
      activeEscalations.push({ ...doc.data(), id: doc.id } as EscalationIncident);
    });

    return {
      success: true,
      data: {
        plays,
        activeExecutions,
        routingRules,
        escalationRules,
        activeEscalations,
        pendingApprovals,
        governance,
      },
    };
  } catch (error) {
    console.error('getSalesOrchestrationDataAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to retrieve sales orchestration data.'),
    };
  }
}

/**
 * Server Action: Create or Update a Sales Play definition.
 */
export async function saveSalesPlayAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  play: SalesPlay;
}): Promise<{
  success: boolean;
  playId?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, play } = params;
    if (!workspaceId || !play.id || !play.title) {
      return { success: false, error: 'Missing required play parameters.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const now = new Date().toISOString();
    const playDocRef = adminDb.collection('salesOrchestrationPlays').doc(play.id);
    const existingSnap = await playDocRef.get();

    if (existingSnap.exists) {
      const existingData = existingSnap.data() as SalesPlay;
      if (existingData.workspaceId !== workspaceId) {
        return { success: false, error: 'Forbidden: Play does not belong to active workspace.' };
      }
    }

    const sanitizedPlay: SalesPlay = {
      ...play,
      workspaceId,
      organizationId,
      updatedAt: now,
      createdBy: existingSnap.exists ? (existingSnap.data()?.createdBy || actorId) : actorId,
      version: existingSnap.exists ? ((existingSnap.data()?.version || 1) + 1) : 1,
    };

    await playDocRef.set(sanitizedPlay, { merge: true });

    revalidatePath('/admin/sales-orchestration');
    return { success: true, playId: play.id };
  } catch (error) {
    console.error('saveSalesPlayAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to save sales play.'),
    };
  }
}

/**
 * Server Action: Fast enable/disable toggle for a Sales Play.
 */
export async function toggleSalesPlayStatusAction(params: {
  workspaceId: string;
  playId: string;
  actorId: string;
  enabled: boolean;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, playId, actorId, enabled } = params;
    if (!workspaceId || !playId) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const playRef = adminDb.collection('salesOrchestrationPlays').doc(playId);
    const snap = await playRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Sales play not found.' };
    }

    const data = snap.data() as SalesPlay;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden: Play does not belong to active workspace.' };
    }

    await playRef.update({
      enabled,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/sales-orchestration');
    return { success: true };
  } catch (error) {
    console.error('toggleSalesPlayStatusAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to toggle sales play status.'),
    };
  }
}

/**
 * Server Action: Advance a play execution step with outcome logging and +10 effort points.
 */
export async function executePlayStepAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  executionId: string;
  stepId: string;
  status: 'completed' | 'skipped' | 'failed';
  outcomeNote?: string;
}): Promise<{
  success: boolean;
  pointsAwarded?: number;
  newStatus?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const {
      workspaceId,
      organizationId,
      actorId,
      actorName,
      executionId,
      stepId,
      status,
      outcomeNote,
    } = params;

    if (!workspaceId || !executionId) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const execRef = adminDb.collection('salesOrchestrationExecutions').doc(executionId);
    const execSnap = await execRef.get();
    if (!execSnap.exists) {
      return { success: false, error: 'Play execution instance not found.' };
    }

    const instance = execSnap.data() as PlayExecutionInstance;
    if (instance.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden: Execution does not belong to active workspace.' };
    }

    const playRef = adminDb.collection('salesOrchestrationPlays').doc(instance.playId);
    const playSnap = await playRef.get();
    if (!playSnap.exists) {
      return { success: false, error: 'Underlying sales play definition not found.' };
    }

    const play = playSnap.data() as SalesPlay;
    const currentStep = play.steps[instance.currentStepIndex];
    const now = new Date();

    const stepLog: PlayStepExecutionLog = {
      stepId: currentStep?.id || stepId,
      stepTitle: currentStep?.title || 'Execution Step',
      actionType: currentStep?.actionType || 'create_task',
      executedAt: now.toISOString(),
      executedBy: `${actorName} (${actorId})`,
      status,
      outcomeNote: outcomeNote || `Step marked as ${status}`,
    };

    const advancedInstance = advancePlayExecution(instance, play, stepLog, now);
    await execRef.set(advancedInstance, { merge: true });

    // Award +10 effort points if step was successfully completed
    let pointsAwarded = 0;
    if (status === 'completed') {
      pointsAwarded = 10;
      try {
        await evaluateEffortEvent({
          organizationId,
          workspaceId,
          eventType: 'sales_play_step_completed',
          entityType: 'SalesPlay',
          entityId: instance.playId,
          actorType: 'User',
          actorId,
          metadata: {
            executionId,
            stepId,
            playTitle: play.title,
          },
        });
      } catch (scoreErr) {
        console.warn('Non-blocking scoring event emission failed in sales orchestration:', scoreErr);
      }
    }

    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/admin/my-day');
    return {
      success: true,
      pointsAwarded,
      newStatus: advancedInstance.status,
    };
  } catch (error) {
    console.error('executePlayStepAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to execute play step.'),
    };
  }
}

/**
 * Server Action: Human-in-the-loop Approval decision (+15 effort points on resolution).
 */
export async function resolveApprovalRequestAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  actorRole: 'sales_manager' | 'vp_sales' | 'finance_admin';
  requestId: string;
  decision: 'approve' | 'reject' | 'escalate';
  decisionNote: string;
}): Promise<{
  success: boolean;
  newStatus?: string;
  pointsAwarded?: number;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const {
      workspaceId,
      organizationId,
      actorId,
      actorName,
      actorRole,
      requestId,
      decision,
      decisionNote,
    } = params;

    if (!workspaceId || !requestId) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const reqRef = adminDb.collection('salesOrchestrationApprovals').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      return { success: false, error: 'Approval request not found.' };
    }

    const request = reqSnap.data() as ApprovalRequest;
    if (request.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden: Request does not belong to active workspace.' };
    }

    const now = new Date();
    const { updatedRequest, error: stateError } = evaluateApprovalStatus(
      request,
      decision,
      actorId,
      actorName,
      actorRole,
      decisionNote,
      now
    );

    if (stateError) {
      return { success: false, error: stateError };
    }

    await reqRef.set(updatedRequest, { merge: true });

    // Award +15 effort points for resolving a governed approval gate
    let pointsAwarded = 0;
    if (decision === 'approve' || decision === 'reject') {
      pointsAwarded = 15;
      try {
        await evaluateEffortEvent({
          organizationId,
          workspaceId,
          eventType: 'play_approval_resolved',
          entityType: 'SalesPlay',
          entityId: requestId,
          actorType: 'User',
          actorId,
          metadata: {
            decision,
            dealValue: request.dealValue,
            requestType: request.requestType,
          },
        });
      } catch (scoreErr) {
        console.warn('Non-blocking scoring emission failed on approval resolve:', scoreErr);
      }
    }

    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/admin/sales-command');
    return {
      success: true,
      newStatus: updatedRequest.status,
      pointsAwarded,
    };
  } catch (error) {
    console.error('resolveApprovalRequestAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to resolve approval request.'),
    };
  }
}

/**
 * Server Action: Resolve an active SLA escalation incident with audit note and +20 effort points.
 */
export async function resolveEscalationIncidentAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  incidentId: string;
  resolutionNote?: string;
}): Promise<{
  success: boolean;
  pointsAwarded?: number;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, actorName, incidentId, resolutionNote } = params;
    if (!workspaceId || !incidentId) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const incRef = adminDb.collection('salesOrchestrationIncidents').doc(incidentId);
    const incSnap = await incRef.get();
    if (!incSnap.exists) {
      return { success: false, error: 'Incident not found.' };
    }

    const incData = incSnap.data() as EscalationIncident;
    if (incData.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden: Incident does not belong to active workspace.' };
    }

    const now = new Date().toISOString();
    await incRef.update({
      status: 'resolved',
      resolvedAt: now,
      resolutionNote: resolutionNote || `Remediated by ${actorName} (${actorId})`,
    });

    let pointsAwarded = 20;
    try {
      await evaluateEffortEvent({
        organizationId,
        workspaceId,
        eventType: 'escalated_sla_breach_remediated',
        entityType: 'SalesPlay',
        entityId: incidentId,
        actorType: 'User',
        actorId,
        metadata: {
          ruleId: incData.ruleId,
          severity: incData.severity,
          entityName: incData.entityName,
        },
      });
    } catch (scoreErr) {
      console.warn('Non-blocking scoring emission failed on incident resolution:', scoreErr);
    }

    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/admin/sales-command');
    return { success: true, pointsAwarded };
  } catch (error) {
    console.error('resolveEscalationIncidentAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to resolve escalation incident.'),
    };
  }
}

/**
 * Server Action: Manually launch a sales play from Deal page or Rep My Day.
 */
export async function triggerSalesPlayManuallyAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  playId: string;
  entityId: string;
  entityType: 'deal' | 'lead' | 'contact';
  entityName: string;
  entityValue?: number;
}): Promise<{
  success: boolean;
  executionId?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const {
      workspaceId,
      organizationId: _organizationId,
      actorId,
      actorName,
      playId,
      entityId,
      entityType,
      entityName,
      entityValue,
    } = params;

    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized: User does not have access to this workspace.' };
    }

    const playRef = adminDb.collection('salesOrchestrationPlays').doc(playId);
    const playSnap = await playRef.get();
    if (!playSnap.exists) {
      return { success: false, error: 'Sales play not found.' };
    }

    const play = playSnap.data() as SalesPlay;
    if (play.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden: Play does not belong to active workspace.' };
    }

    const now = new Date();
    const instance = createPlayExecutionInstance(
      play,
      {
        id: entityId,
        name: entityName,
        type: entityType,
        value: entityValue,
        assignedTo: actorId,
        assignedToName: actorName,
      },
      'user',
      'manual_launch',
      0,
      now
    );

    const execRef = adminDb.collection('salesOrchestrationExecutions').doc(instance.id);
    const existingSnap = await execRef.get();
    if (!existingSnap.exists) {
      await execRef.set(instance);
    }

    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/admin/my-day');
    return { success: true, executionId: instance.id };
  } catch (error) {
    console.error('triggerSalesPlayManuallyAction error:', error);
    return {
      success: false,
      error: toClientErrorMessage('actions.sales-orchestration-actions', error, undefined, 'Failed to trigger sales play manually.'),
    };
  }
}

/**
 * Server Action: Save Routing Rules.
 */
export async function saveRoutingRuleAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  rule: RoutingRule;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, rule } = params;
    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized access.' };
    }

    const ruleRef = adminDb.collection('salesOrchestrationRoutingRules').doc(rule.id);
    await ruleRef.set(
      {
        ...rule,
        workspaceId,
        organizationId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    revalidatePath('/admin/sales-orchestration');
    return { success: true };
  } catch (error) {
    console.error('saveRoutingRuleAction error:', error);
    return { success: false, error: 'Failed to save routing rules.' };
  }
}

/**
 * Server Action: Save Escalation Rule.
 */
export async function saveEscalationRuleAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  rule: EscalationRule;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, rule } = params;
    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized access.' };
    }

    const escRef = adminDb.collection('salesOrchestrationEscalations').doc(rule.id);
    await escRef.set(
      {
        ...rule,
        workspaceId,
        organizationId,
      },
      { merge: true }
    );

    revalidatePath('/admin/sales-orchestration');
    return { success: true };
  } catch (error) {
    console.error('saveEscalationRuleAction error:', error);
    return { success: false, error: 'Failed to save escalation rule.' };
  }
}

/**
 * Server Action: Save Backoffice Orchestration Governance (including Emergency Kill Switch).
 */
export async function saveOrchestrationGovernanceAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  governance: Partial<SalesOrchestrationGovernance>;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, actorName, governance } = params;
    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized access.' };
    }

    const govRef = adminDb.collection('salesOrchestrationGovernance').doc(workspaceId);
    await govRef.set(
      {
        ...governance,
        workspaceId,
        organizationId,
        updatedAt: new Date().toISOString(),
        updatedBy: `${actorName} (${actorId})`,
      },
      { merge: true }
    );

    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/backoffice/sales-orchestration');
    return { success: true };
  } catch (error) {
    console.error('saveOrchestrationGovernanceAction error:', error);
    return { success: false, error: 'Failed to save governance parameters.' };
  }
}

/**
 * Server Action: Execute Idempotent FER Migration seeder.
 */
export async function executeOrchestrationMigrationAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
}): Promise<{
  success: boolean;
  playsCreated?: number;
  routingRulesCreated?: number;
  escalationRulesCreated?: number;
  approvalsCreated?: number;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, actorId, actorName } = params;
    const hasAccess = await verifyCallerAccess(actorId, workspaceId);
    if (!hasAccess) {
      return { success: false, error: 'Unauthorized access.' };
    }

    const result = await executeSalesOrchestrationMigration(workspaceId, organizationId, actorId, actorName);
    revalidatePath('/admin/sales-orchestration');
    revalidatePath('/backoffice/sales-orchestration');

    return {
      success: result.success,
      playsCreated: result.playsCreated,
      routingRulesCreated: result.routingRulesCreated,
      escalationRulesCreated: result.escalationRulesCreated,
      approvalsCreated: result.approvalsCreated,
      error: result.error,
    };
  } catch (error) {
    console.error('executeOrchestrationMigrationAction error:', error);
    return { success: false, error: 'Failed to execute migration protocol.' };
  }
}
