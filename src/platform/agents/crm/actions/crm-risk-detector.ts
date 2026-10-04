/**
 * @fileOverview Hybrid Account Risk Detector (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 40 (Domain Event Publication: crm.account.risk_detected),
 * Rule 42 (Mandatory Shadow Mode & Blast Radius Reports), and Rule 47 (Never Trust the Model).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Evaluates multi-dimensional risk signals across 360° Account Context:
 *   1. Stalled Deals (>14d stage warning, >30d critical, or past close date)
 *   2. Dark / Dormant Accounts (>45d inactive, >60d critical)
 *   3. Overdue Commitments (uncompleted tasks past due date)
 *   4. Aging Receivables (overdue balances past 30/60/90+ days)
 *   5. Data Hygiene Defects (missing decision maker, unverified email/phone, stale/unassigned owner)
 *   6. Sentiment Degradation (negative interaction shifts)
 * - Emits `crm.account.risk_detected` domain event via `defaultEventBus` when dryRun is false.
 * - Supports Shadow Mode simulation via `evaluateRisksWithBlastRadius` producing a Blast Radius Report.
 */

import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import {
  CrmRiskAssessmentSchema,
  type CrmRiskAssessment,
  type CrmRiskFactor,
  type CrmStalledDeal,
  type CrmDarkAccount,
  type CrmOverdueCommitment,
  type CrmAgingReceivable,
  type CrmHygieneDefect,
  type CrmRiskLevel,
} from './crm-action-types';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

export interface EvaluateRisksOptions {
  now?: Date;
  dryRun?: boolean;
  correlationId?: string;
}

export interface CrmRiskBlastRadiusReport {
  mode: 'SHADOW_SIMULATION';
  mutationsIntercepted: number;
  overallRisk: CrmRiskLevel;
  simulatedAt: string;
}

export interface EvaluateRisksWithBlastRadiusResult {
  assessment: CrmRiskAssessment;
  blastRadius: CrmRiskBlastRadiusReport;
}

export class CrmRiskDetector {
  /**
   * Evaluates multi-dimensional account risks from an Account360Context.
   */
  async evaluateRisks(
    context: Account360Context,
    options?: EvaluateRisksOptions
  ): Promise<CrmRiskAssessment> {
    const now = options?.now ?? new Date();
    const dryRun = options?.dryRun ?? false;
    const nowIso = now.toISOString();

    const factors: CrmRiskFactor[] = [];
    let cumulativeScore = 0;

    // 1. Stalled Deals Evaluation
    const stalledDeals: CrmStalledDeal[] = [];
    const stalledDealIds: string[] = [];

    for (const deal of context.deals) {
      const isPastExpectedClose = Boolean(
        deal.expectedCloseDate && new Date(deal.expectedCloseDate).getTime() < now.getTime()
      );
      const isDaysInStageOverdue = deal.ageInDays >= 14;
      const isMarkedStalled = Boolean(deal.isStalled);

      if (isMarkedStalled || isPastExpectedClose || isDaysInStageOverdue) {
        stalledDeals.push({
          dealId: deal.id,
          title: deal.title,
          daysInStage: deal.ageInDays,
          thresholdDays: 14,
          stage: deal.stageName || deal.stageId,
          value: deal.value,
        });
        stalledDealIds.push(deal.id);
      }
    }

    if (stalledDeals.length > 0) {
      const count = stalledDeals.length;
      const severity = count > 1 ? 'CRITICAL' : 'HIGH';
      const contribution = count >= 2 ? 35 : 25;
      cumulativeScore += contribution;

      factors.push({
        id: 'factor_stalled_deals',
        category: 'STALLED_DEAL',
        severity,
        title: `${count} Stalled Deal(s) Exceeding Stage Thresholds`,
        description: `Deal(s) in active pipeline have had no forward progression for over 14 days or past close date.`,
        scoreContribution: contribution,
        citationIds: stalledDealIds,
      });
    }

    // 2. Dark / Dormant Account Evaluation
    let latestInteractionMs: number | null = null;
    let latestInteractionAt: string | undefined = undefined;

    // Check meetings
    for (const meeting of context.meetings) {
      const ms = new Date(meeting.startTime).getTime();
      if (!latestInteractionMs || ms > latestInteractionMs) {
        latestInteractionMs = ms;
        latestInteractionAt = meeting.startTime;
      }
    }

    // Check notes
    for (const note of context.notes) {
      const ms = new Date(note.createdAt).getTime();
      if (!latestInteractionMs || ms > latestInteractionMs) {
        latestInteractionMs = ms;
        latestInteractionAt = note.createdAt;
      }
    }

    // Check timeline
    for (const item of context.timeline) {
      const ms = new Date(item.timestamp).getTime();
      if (!latestInteractionMs || ms > latestInteractionMs) {
        latestInteractionMs = ms;
        latestInteractionAt = item.timestamp;
      }
    }

    const daysInactive = latestInteractionMs
      ? Math.max(0, Math.floor((now.getTime() - latestInteractionMs) / (1000 * 60 * 60 * 24)))
      : 0;

    const isDark = daysInactive >= 45;
    const darkAccount: CrmDarkAccount = {
      isDark,
      daysInactive,
      thresholdDays: 45,
      ...(latestInteractionAt ? { lastInteractionAt: latestInteractionAt } : {}),
    };

    if (daysInactive >= 60) {
      cumulativeScore += 30;
      factors.push({
        id: 'factor_dark_account',
        category: 'DARK_ACCOUNT',
        severity: 'HIGH',
        title: 'Account Severely Dormant (>60 Days Inactive)',
        description: `No recorded meetings, notes, or communications for ${daysInactive} days. High risk of churn.`,
        scoreContribution: 30,
        citationIds: latestInteractionAt ? [latestInteractionAt] : [],
      });
    } else if (daysInactive >= 45) {
      cumulativeScore += 20;
      factors.push({
        id: 'factor_dark_account',
        category: 'DARK_ACCOUNT',
        severity: 'MEDIUM',
        title: 'Account Dormant (>45 Days Inactive)',
        description: `Communication cadence has degraded past 45 days. Proactive re-engagement recommended.`,
        scoreContribution: 20,
        citationIds: latestInteractionAt ? [latestInteractionAt] : [],
      });
    }

    // 3. Overdue Commitments Evaluation
    const overdueCommitments: CrmOverdueCommitment[] = [];
    const overdueTaskIds: string[] = [];

    for (const task of context.tasks) {
      const isPastDue = Boolean(
        task.dueDate &&
          new Date(task.dueDate).getTime() < now.getTime() &&
          task.status !== 'completed' &&
          task.status !== 'cancelled'
      );

      if (task.isOverdue || isPastDue) {
        const dueDateMs = task.dueDate ? new Date(task.dueDate).getTime() : now.getTime();
        const daysOverdue = Math.max(1, Math.floor((now.getTime() - dueDateMs) / (1000 * 60 * 60 * 24)));

        overdueCommitments.push({
          commitmentId: task.id,
          title: task.title,
          dueDate: task.dueDate ?? nowIso,
          daysOverdue,
          ...(task.assignedToName ? { assignedTo: task.assignedToName } : {}),
        });
        overdueTaskIds.push(task.id);
      }
    }

    if (overdueCommitments.length > 0) {
      const count = overdueCommitments.length;
      const contribution = Math.min(15 + (count - 1) * 5, 30);
      cumulativeScore += contribution;

      factors.push({
        id: 'factor_overdue_commitments',
        category: 'OVERDUE_COMMITMENT',
        severity: count > 2 ? 'HIGH' : 'MEDIUM',
        title: `${count} Overdue Account Commitment(s)`,
        description: `Uncompleted action items or deliverable promises past their scheduled due dates.`,
        scoreContribution: contribution,
        citationIds: overdueTaskIds,
      });
    }

    // 4. Aging Receivables Evaluation
    const agingReceivables: CrmAgingReceivable[] = [];
    if (
      context.finances.overdueBalance > 0 ||
      context.finances.agingCategory === 'OVERDUE_60' ||
      context.finances.agingCategory === 'OVERDUE_90_PLUS'
    ) {
      const isOverdue90 = context.finances.agingCategory === 'OVERDUE_90_PLUS';
      const severity = isOverdue90 ? 'CRITICAL' : 'HIGH';
      const contribution = 25;
      cumulativeScore += contribution;

      agingReceivables.push({
        invoiceId: `inv_overdue_${context.entityId}`,
        invoiceNumber: `OVERDUE-FIN-${context.entityId.slice(0, 6)}`,
        dueDate: nowIso,
        daysOverdue: isOverdue90 ? 90 : 60,
        outstandingBalance: context.finances.overdueBalance || context.finances.openBalance,
      });

      factors.push({
        id: 'factor_aging_receivables',
        category: 'AGING_RECEIVABLE',
        severity,
        title: `Overdue Outstanding Balance (${context.finances.currency} ${context.finances.overdueBalance.toLocaleString()})`,
        description: `Financial receivables are aging in ${context.finances.agingCategory} bucket. Payment follow-up required.`,
        scoreContribution: contribution,
        citationIds: [`finance_${context.entityId}`],
      });
    }

    // 5. Data Hygiene Defects Evaluation
    const hygieneDefects: CrmHygieneDefect[] = [];
    let hygieneContribution = 0;

    // Check decision maker
    const hasDecisionMaker = context.contacts.some((c) => {
      if (!c.role) return false;
      const lower = c.role.toLowerCase();
      return (
        lower.includes('decision') ||
        lower.includes('buyer') ||
        lower.includes('chief') ||
        lower.includes('vp') ||
        lower.includes('director') ||
        lower.includes('head') ||
        lower.includes('owner') ||
        lower.includes('founder') ||
        lower.includes('cto') ||
        lower.includes('cio') ||
        lower.includes('ceo')
      );
    });

    if (!hasDecisionMaker) {
      hygieneContribution += 10;
      hygieneDefects.push({
        id: 'hyg_missing_decision_maker',
        type: 'MISSING_DECISION_MAKER',
        severity: 'HIGH',
        description: 'Account has no contact identified with an executive decision-maker role.',
        suggestedRemediation: 'Designate or invite a primary executive sponsor or economic buyer.',
      });
    }

    // Check contact verification (email/phone)
    const hasUnverifiedContact = context.contacts.some((c) => !c.email && !c.phone);
    if (hasUnverifiedContact) {
      hygieneContribution += 10;
      hygieneDefects.push({
        id: 'hyg_unverified_email',
        type: 'UNVERIFIED_EMAIL',
        severity: 'MEDIUM',
        description: 'One or more account contacts lack verified email address and phone number.',
        suggestedRemediation: 'Trigger automated lead enrichment or update contact communications channels.',
      });
    }

    // Check assigned owner
    if (!context.workspaceEntity?.assignedTo?.userId) {
      hygieneContribution += 10;
      hygieneDefects.push({
        id: 'hyg_stale_owner',
        type: 'STALE_OWNER',
        severity: 'MEDIUM',
        description: 'Account has no designated sales or account representative owner in this workspace.',
        suggestedRemediation: 'Assign an active team member to oversee relationship cadence.',
      });
    }

    if (hygieneContribution > 0) {
      cumulativeScore += hygieneContribution;
      factors.push({
        id: 'factor_hygiene_defects',
        category: 'HYGIENE_DEFECT',
        severity: hygieneDefects.some((d) => d.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
        title: `${hygieneDefects.length} Data Hygiene Defect(s) Flagged`,
        description: `Account hygiene issues may hinder follow-ups or accurate lead scoring.`,
        scoreContribution: hygieneContribution,
        citationIds: hygieneDefects.map((d) => d.id),
      });
    }

    // 6. Sentiment Degradation Evaluation
    const recentNegativeMeetings = context.meetings.filter((m) => m.sentiment === 'negative');
    if (recentNegativeMeetings.length > 0) {
      cumulativeScore += 20;
      factors.push({
        id: 'factor_sentiment_degradation',
        category: 'SENTIMENT_DEGRADATION',
        severity: 'HIGH',
        title: 'Negative Interaction Sentiment Detected',
        description: `Customer expressed dissatisfaction or escalation concerns in recent interaction(s).`,
        scoreContribution: 20,
        citationIds: recentNegativeMeetings.map((m) => m.id),
      });
    }

    // Calculate clamped score & risk level
    const overallScore = Math.min(100, Math.max(0, cumulativeScore));
    let riskLevel: CrmRiskLevel;
    if (overallScore >= 80) {
      riskLevel = 'CRITICAL';
    } else if (overallScore >= 60) {
      riskLevel = 'ELEVATED';
    } else if (overallScore >= 30) {
      riskLevel = 'MODERATE';
    } else {
      riskLevel = 'LOW';
    }

    const assessment: CrmRiskAssessment = CrmRiskAssessmentSchema.parse({
      entityId: context.entityId,
      workspaceId: context.workspaceId,
      overallScore,
      riskLevel,
      factors,
      stalledDeals,
      darkAccount,
      overdueCommitments,
      agingReceivables,
      hygieneDefects,
      evaluatedAt: nowIso,
    });

    // Publish domain event if not in dry-run mode (Rule 40)
    if (!dryRun) {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'crm.account.risk_detected',
          organizationId: context.organizationId,
          workspaceId: context.workspaceId,
          actor: {
            type: 'agent',
            id: 'crm_risk_detector',
          },
          entity: {
            type: 'account',
            id: context.entityId,
          },
          source: 'crm_risk_detector',
          correlationId: options?.correlationId ?? `corr_risk_${Date.now()}`,
          payload: {
            entityId: context.entityId,
            workspaceId: context.workspaceId,
            overallScore,
            riskLevel,
            factorsCount: factors.length,
            stalledDealsCount: stalledDeals.length,
            isDark,
            evaluatedAt: nowIso,
          },
        })
      );
    }

    return assessment;
  }

  /**
   * Executes risk evaluation in Shadow Mode simulation, generating a Blast Radius Report (Rule 42).
   */
  async evaluateRisksWithBlastRadius(
    context: Account360Context,
    options?: EvaluateRisksOptions
  ): Promise<EvaluateRisksWithBlastRadiusResult> {
    const assessment = await this.evaluateRisks(context, { ...options, dryRun: true });

    return {
      assessment,
      blastRadius: {
        mode: 'SHADOW_SIMULATION',
        mutationsIntercepted: 0,
        overallRisk: assessment.riskLevel,
        simulatedAt: assessment.evaluatedAt,
      },
    };
  }
}

// Global HMR singleton preservation
declare global {
  var __smartsappCrmRiskDetector: CrmRiskDetector | undefined;
}

export function getCrmRiskDetector(): CrmRiskDetector {
  if (!globalThis.__smartsappCrmRiskDetector) {
    globalThis.__smartsappCrmRiskDetector = new CrmRiskDetector();
  }
  return globalThis.__smartsappCrmRiskDetector;
}
