/**
 * @fileOverview Autonomous Next-Best-Action (NBA) Engine (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary: L0 to L4),
 * Rule 19 (Deterministic Idempotency Keys), Rule 21/22 (Two-Phase Action Model & SHA-256 Binding),
 * Rule 27 (Saga Compensation Binding via CRM_ROLLBACK_MATRIX), Rule 40 (Domain Event Publication),
 * Rule 41 (Explainability Grid: WHAT, WHY, IMPACT, BLAST RADIUS), and Rule 42 (Shadow Mode Simulation).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Synthesizes prioritized, high-impact next-best-actions mapped directly to detected account risks.
 * - Every proposed action carries an explicit Rule 41 explainability grid.
 * - Every state-mutating action carries a deterministic idempotency key and a compensating capability
 *   from `CRM_ROLLBACK_MATRIX`.
 * - State mutations target operational workspace state (`/workspace_entities/{workspaceId}_{entityId}`)
 *   and NEVER mutate corporate identity master records directly (Rule 69).
 */

import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import {
  CrmProposedActionSchema,
  type CrmProposedAction,
  type CrmRiskAssessment,
  type CrmActionPriority,
  CRM_ROLLBACK_MATRIX,
  computeCrmActionIdempotencyKey,
} from './crm-action-types';
import { getCrmRiskDetector } from './crm-risk-detector';
import { defaultEventBus } from '@/platform/events/event-bus';

export interface GenerateNbaOptions {
  now?: Date;
  dryRun?: boolean;
  correlationId?: string;
  limit?: number;
}

export interface NbaBlastRadiusReport {
  mode: 'SHADOW_SIMULATION';
  totalActionsProposed: number;
  actionsRequiringApproval: number;
  maxRiskTier: string;
  simulatedAt: string;
}

export interface GenerateNbaWithBlastRadiusResult {
  actions: CrmProposedAction[];
  blastRadius: NbaBlastRadiusReport;
}

const PRIORITY_ORDER: Record<CrmActionPriority, number> = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

export class CrmNextBestActionEngine {
  /**
   * Generates prioritized next-best-actions for an account based on 360° context & risk assessment.
   */
  async generateNextBestActions(
    context: Account360Context,
    assessment?: CrmRiskAssessment,
    options?: GenerateNbaOptions
  ): Promise<CrmProposedAction[]> {
    const now = options?.now ?? new Date();
    const dryRun = options?.dryRun ?? false;
    const limit = options?.limit ?? 5;
    const nowIso = now.toISOString();

    // 1. Ensure Risk Assessment is available
    const activeAssessment =
      assessment ??
      (await getCrmRiskDetector().evaluateRisks(context, {
        now,
        dryRun: true,
        correlationId: options?.correlationId,
      }));

    const rawActions: CrmProposedAction[] = [];

    // 2. Synthesize Actions from Detected Risks

    // A. Stalled Deals -> Update Stage or Schedule Executive Checkpoint
    for (const deal of activeAssessment.stalledDeals) {
      const updatePayload: Record<string, unknown> = {
        dealId: deal.dealId,
        currentStage: deal.stage,
        targetStage: 'proposal_review',
        suggestedAction: 'advance_or_remedy',
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_update_stage_${deal.dealId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'UPDATE_STAGE',
          priority: 'HIGH',
          riskLevel: 'L2_STATE_MUTATION',
          explainability: {
            what: `Advance or review stage for stalled deal "${deal.title}"`,
            why: `Deal has spent ${deal.daysInStage} days in "${deal.stage}" stage exceeding the ${deal.thresholdDays}-day threshold.`,
            impact: `Re-establishes deal momentum and protects projected revenue of $${deal.value.toLocaleString()}.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: deal.value,
              isReversible: CRM_ROLLBACK_MATRIX.UPDATE_STAGE.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'UPDATE_STAGE', updatePayload),
          targetCapabilityId: 'crm.deal.update_stage',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.UPDATE_STAGE.compensatingCapabilityId,
          payload: updatePayload,
          requiresApproval: true,
          createdAt: nowIso,
        })
      );

      const meetingPayload: Record<string, unknown> = {
        dealId: deal.dealId,
        subject: `Executive Checkpoint: ${deal.title}`,
        durationMinutes: 30,
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_meet_deal_${deal.dealId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'SCHEDULE_MEETING',
          priority: 'HIGH',
          riskLevel: 'L1_INTERNAL_DRAFT',
          explainability: {
            what: `Schedule executive checkpoint regarding "${deal.title}"`,
            why: `Direct executive alignment required to unblock negotiation bottlenecks and verify timeline.`,
            impact: `Clarifies open commercial terms and prevents deal slippage into next quarter.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: deal.value,
              isReversible: CRM_ROLLBACK_MATRIX.SCHEDULE_MEETING.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'SCHEDULE_MEETING', meetingPayload),
          targetCapabilityId: 'crm.calendar.schedule_meeting',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.SCHEDULE_MEETING.compensatingCapabilityId,
          payload: meetingPayload,
          requiresApproval: false,
          createdAt: nowIso,
        })
      );
    }

    // B. Dark / Dormant Account -> Re-engagement Outreach
    if (activeAssessment.darkAccount.isDark) {
      const daysInactive = activeAssessment.darkAccount.daysInactive;
      const isUrgent = daysInactive >= 60;
      const recipient = context.contacts[0]?.email ?? context.entity.email ?? '';

      const outreachPayload: Record<string, unknown> = {
        entityId: context.entityId,
        channel: 'email',
        recipient,
        subject: `Checking in: ${context.entity.name} & SmartSapp Roadmap Update`,
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_reengage_${context.entityId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'DRAFT_OUTREACH',
          priority: isUrgent ? 'URGENT' : 'HIGH',
          riskLevel: 'L1_INTERNAL_DRAFT',
          explainability: {
            what: `Draft executive re-engagement email to account stakeholders`,
            why: `Account has had 0 recorded interactions for ${daysInactive} days. Churn risk elevated.`,
            impact: `Restores communication cadence and surfaces potential roadmap concerns before renewal.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: 0,
              isReversible: CRM_ROLLBACK_MATRIX.DRAFT_OUTREACH.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'DRAFT_OUTREACH', outreachPayload),
          targetCapabilityId: 'crm.outreach.draft_email',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.DRAFT_OUTREACH.compensatingCapabilityId,
          payload: outreachPayload,
          requiresApproval: false,
          createdAt: nowIso,
        })
      );
    }

    // C. Overdue Commitments -> Urgent Remediation Tasks
    for (const commitment of activeAssessment.overdueCommitments) {
      const taskPayload: Record<string, unknown> = {
        title: `[URGENT] Remediate: ${commitment.title}`,
        dueDate: new Date(now.getTime() + 86400000).toISOString(),
        priority: 'urgent',
        originalCommitmentId: commitment.commitmentId,
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_task_${commitment.commitmentId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'CREATE_TASK',
          priority: 'URGENT',
          riskLevel: 'L2_STATE_MUTATION',
          explainability: {
            what: `Remediate overdue commitment: "${commitment.title}"`,
            why: `Commitment is ${commitment.daysOverdue} days past scheduled due date without resolution.`,
            impact: `Preserves client trust and ensures operational delivery commitments are met.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: 0,
              isReversible: CRM_ROLLBACK_MATRIX.CREATE_TASK.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'CREATE_TASK', taskPayload),
          targetCapabilityId: 'crm.task.create',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.CREATE_TASK.compensatingCapabilityId,
          payload: taskPayload,
          requiresApproval: true,
          createdAt: nowIso,
        })
      );
    }

    // D. Aging Receivables -> Polite Billing Outreach
    for (const receivable of activeAssessment.agingReceivables) {
      const billingPayload: Record<string, unknown> = {
        entityId: context.entityId,
        channel: 'email',
        invoiceNumber: receivable.invoiceNumber,
        outstandingBalance: receivable.outstandingBalance,
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_finance_outreach_${receivable.invoiceId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'DRAFT_OUTREACH',
          priority: 'HIGH',
          riskLevel: 'L1_INTERNAL_DRAFT',
          explainability: {
            what: `Draft polite accounts receivable check-in regarding ${receivable.invoiceNumber}`,
            why: `Outstanding balance of $${receivable.outstandingBalance.toLocaleString()} is ${receivable.daysOverdue} days overdue.`,
            impact: `Accelerates cash collection and verifies invoice receipt without damaging client relationship.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: receivable.outstandingBalance,
              isReversible: CRM_ROLLBACK_MATRIX.DRAFT_OUTREACH.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'DRAFT_OUTREACH', billingPayload),
          targetCapabilityId: 'crm.outreach.draft_email',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.DRAFT_OUTREACH.compensatingCapabilityId,
          payload: billingPayload,
          requiresApproval: false,
          createdAt: nowIso,
        })
      );
    }

    // E. Data Hygiene Defects -> Lead Enrichment or Owner Assignment
    for (const defect of activeAssessment.hygieneDefects) {
      if (defect.type === 'MISSING_DECISION_MAKER' || defect.type === 'UNVERIFIED_EMAIL') {
        const domain = context.entity.email?.split('@')[1] || '';
        const enrichPayload: Record<string, unknown> = {
          entityId: context.entityId,
          domain,
          companyName: context.entity.name,
        };

        rawActions.push(
          CrmProposedActionSchema.parse({
            id: `act_enrich_${context.entityId}`,
            entityId: context.entityId,
            workspaceId: context.workspaceId,
            actionType: 'ENRICH_LEAD',
            priority: 'MEDIUM',
            riskLevel: 'L2_STATE_MUTATION',
            explainability: {
              what: `Execute automated lead enrichment for contact intelligence`,
              why: defect.description,
              impact: `Discovers verified decision-maker emails, corporate firmographics, and executive sponsors.`,
              blastRadius: {
                affectedRecordsCount: 1,
                financialExposureUsd: 0,
                isReversible: CRM_ROLLBACK_MATRIX.ENRICH_LEAD.reversible,
              },
            },
            idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'ENRICH_LEAD', enrichPayload),
            targetCapabilityId: 'crm.lead.enrich',
            compensatingCapabilityId: CRM_ROLLBACK_MATRIX.ENRICH_LEAD.compensatingCapabilityId,
            payload: enrichPayload,
            requiresApproval: true,
            createdAt: nowIso,
          })
        );
      } else if (defect.type === 'STALE_OWNER') {
        const ownerPayload: Record<string, unknown> = {
          entityId: context.entityId,
          workspaceId: context.workspaceId,
        };

        rawActions.push(
          CrmProposedActionSchema.parse({
            id: `act_assign_owner_${context.entityId}`,
            entityId: context.entityId,
            workspaceId: context.workspaceId,
            actionType: 'ASSIGN_OWNER',
            priority: 'HIGH',
            riskLevel: 'L2_STATE_MUTATION',
            explainability: {
              what: `Assign designated account representative owner`,
              why: defect.description,
              impact: `Ensures unambiguous rep accountability for ongoing touchpoints and commitments.`,
              blastRadius: {
                affectedRecordsCount: 1,
                financialExposureUsd: 0,
                isReversible: CRM_ROLLBACK_MATRIX.ASSIGN_OWNER.reversible,
              },
            },
            idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'ASSIGN_OWNER', ownerPayload),
            targetCapabilityId: 'crm.workspace_entity.assign_owner',
            compensatingCapabilityId: CRM_ROLLBACK_MATRIX.ASSIGN_OWNER.compensatingCapabilityId,
            payload: ownerPayload,
            requiresApproval: true,
            createdAt: nowIso,
          })
        );
      }
    }

    // F. Fallback Baseline Action if no high risks detected
    if (rawActions.length === 0) {
      const reviewPayload: Record<string, unknown> = {
        title: `Strategic Relationship Review: ${context.entity.name}`,
        dueDate: new Date(now.getTime() + 14 * 86400000).toISOString(),
        priority: 'low',
      };

      rawActions.push(
        CrmProposedActionSchema.parse({
          id: `act_review_${context.entityId}`,
          entityId: context.entityId,
          workspaceId: context.workspaceId,
          actionType: 'CREATE_TASK',
          priority: 'LOW',
          riskLevel: 'L2_STATE_MUTATION',
          explainability: {
            what: `Schedule routine strategic relationship check-in`,
            why: `Account metrics are healthy; proactive review maintains account advocacy and expansion readiness.`,
            impact: `Ensures ongoing stakeholder alignment and roadmap awareness.`,
            blastRadius: {
              affectedRecordsCount: 1,
              financialExposureUsd: 0,
              isReversible: CRM_ROLLBACK_MATRIX.CREATE_TASK.reversible,
            },
          },
          idempotencyKey: computeCrmActionIdempotencyKey(context.entityId, 'CREATE_TASK', reviewPayload),
          targetCapabilityId: 'crm.task.create',
          compensatingCapabilityId: CRM_ROLLBACK_MATRIX.CREATE_TASK.compensatingCapabilityId,
          payload: reviewPayload,
          requiresApproval: true,
          createdAt: nowIso,
        })
      );
    }

    // 3. Deduplicate by unique target / action type
    const seenActionKeys = new Set<string>();
    const deduplicatedActions: CrmProposedAction[] = [];

    for (const action of rawActions) {
      const key = `${action.actionType}:${action.idempotencyKey}`;
      if (!seenActionKeys.has(key)) {
        seenActionKeys.add(key);
        deduplicatedActions.push(action);
      }
    }

    // 4. Sort by priority: URGENT -> HIGH -> MEDIUM -> LOW
    deduplicatedActions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    const finalActions = deduplicatedActions.slice(0, limit);

    // 5. Publish domain event if not in dry-run mode (Rule 40)
    if (!dryRun) {
      for (const action of finalActions) {
        await defaultEventBus.publish({
          id: `evt_action_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'crm.action.proposed',
          organizationId: context.organizationId,
          payload: {
            actionId: action.id,
            entityId: action.entityId,
            workspaceId: action.workspaceId,
            actionType: action.actionType,
            priority: action.priority,
            riskLevel: action.riskLevel,
            requiresApproval: action.requiresApproval,
            idempotencyKey: action.idempotencyKey,
            proposedAt: nowIso,
          },
          timestamp: nowIso,
          version: 1,
        });
      }
    }

    return finalActions;
  }

  /**
   * Generates next-best-actions in Shadow Mode simulation, providing a Blast Radius Report (Rule 42).
   */
  async generateNextBestActionsWithBlastRadius(
    context: Account360Context,
    assessment?: CrmRiskAssessment,
    options?: GenerateNbaOptions
  ): Promise<GenerateNbaWithBlastRadiusResult> {
    const actions = await this.generateNextBestActions(context, assessment, { ...options, dryRun: true });

    const actionsRequiringApproval = actions.filter((a) => a.requiresApproval).length;
    const maxRiskTier = actions.some((a) => a.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE')
      ? 'L4_PRIVILEGED_DESTRUCTIVE'
      : actions.some((a) => a.riskLevel === 'L3_EXTERNAL_COMMUNICATION_FINANCE')
        ? 'L3_EXTERNAL_COMMUNICATION_FINANCE'
        : actions.some((a) => a.riskLevel === 'L2_STATE_MUTATION')
          ? 'L2_STATE_MUTATION'
          : actions.some((a) => a.riskLevel === 'L1_INTERNAL_DRAFT')
            ? 'L1_INTERNAL_DRAFT'
            : 'L0_READ';

    return {
      actions,
      blastRadius: {
        mode: 'SHADOW_SIMULATION',
        totalActionsProposed: actions.length,
        actionsRequiringApproval,
        maxRiskTier,
        simulatedAt: (options?.now ?? new Date()).toISOString(),
      },
    };
  }
}

// Global HMR singleton preservation
declare global {
  // eslint-disable-next-line no-var
  var __smartsappCrmNextBestActionEngine: CrmNextBestActionEngine | undefined;
}

export function getCrmNextBestActionEngine(): CrmNextBestActionEngine {
  if (!globalThis.__smartsappCrmNextBestActionEngine) {
    globalThis.__smartsappCrmNextBestActionEngine = new CrmNextBestActionEngine();
  }
  return globalThis.__smartsappCrmNextBestActionEngine;
}
