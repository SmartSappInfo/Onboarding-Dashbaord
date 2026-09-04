/**
 * @fileoverview Pure Deterministic Computational Engine for AI Sales Workforce (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Zero external I/O or network dependencies. Provides 100% deterministic, side-effect-free algorithms for:
 * 1. Autonomy maturity evaluation & 3-tier confidence gating.
 * 2. Sensitive commercial action override enforcement.
 * 3. Next-best action multi-factor priority ranking.
 * 4. CRM data hygiene anomaly detection and atomic repair proposals.
 * 5. Approval state machine transitions.
 * 6. Fleet ROI, time-saved, and health index analytics.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Must remain pure functions for reproducible Vitest unit tests.
 *
 * @testability Pure mathematical functions designed for sub-millisecond execution.
 */

import type {
  AiAgentProfile,
  AiAutonomyLevel,
  AiRecommendationPriority,
  AiWorkforceGovernancePolicy,
  AiCrmHygieneIssue,
  AiSalesApproval,
  AiApprovalStatus,
  AiExecutionAuditDoc,
  AiSalesRecommendation,
  AiFleetMetrics,
} from './types';

export interface AutonomyDecisionResult {
  decision: 'suppress' | 'recommend' | 'prepare' | 'request_approval' | 'execute_autonomous';
  effectiveAutonomyLevel: AiAutonomyLevel;
  reason: string;
}

export interface PriorityScoreResult {
  priority: AiRecommendationPriority;
  compositeScore: number;
}

export interface DealHygieneContext {
  id: string;
  name: string;
  value: number;
  stage: string;
  status: string;
  lastActivityAt?: string;
  nextStepDate?: string;
  nextStepDescription?: string;
  stakeholderCount?: number;
  assignedTo?: string;
}

export interface ContactHygieneContext {
  id: string;
  name: string;
  email?: string;
  leadScore?: number;
  assignedTo?: string;
  createdAt: string;
}

/**
 * Evaluates the final dispatch decision for an AI recommendation based on
 * agent autonomy level, governance kill switches, confidence gating, and action sensitivity.
 */
export function evaluateAgentAutonomyDecision(params: {
  agentProfile: AiAgentProfile;
  governance: AiWorkforceGovernancePolicy;
  proposedAction: {
    actionType: string;
    isSensitive?: boolean;
    confidenceScore: number;
  };
}): AutonomyDecisionResult {
  const { agentProfile, governance, proposedAction } = params;

  // 1. Emergency Kill Switch halts all autonomous execution instantly
  if (governance.emergencyKillSwitch) {
    return {
      decision: 'recommend',
      effectiveAutonomyLevel: 1,
      reason: 'Emergency Kill Switch is active. Autonomous execution frozen workspace-wide.',
    };
  }

  // 2. Minimum confidence suppression: throw out noisy hallucinations
  const minPrepare = governance.minConfidenceForPrepare ?? 60;
  if (proposedAction.confidenceScore < minPrepare) {
    return {
      decision: 'suppress',
      effectiveAutonomyLevel: 0,
      reason: `Confidence (${proposedAction.confidenceScore}%) is below minimum preparation threshold (${minPrepare}%). Suppressed to prevent noise.`,
    };
  }

  // 3. Sensitive Action Gate: Commercial risks always require human approval
  if (proposedAction.isSensitive && governance.sensitiveActionsRequireApproval) {
    return {
      decision: 'request_approval',
      effectiveAutonomyLevel: 3,
      reason: 'Sensitive commercial action detected (e.g. discount, cancellation, stage skip). Mandating Level 3 Human Approval.',
    };
  }

  // 4. Resolve against agent's configured autonomy maturity level
  switch (agentProfile.currentAutonomyLevel) {
    case 0:
      return {
        decision: 'suppress',
        effectiveAutonomyLevel: 0,
        reason: 'Agent is configured at Level 0 (Observe Only). No outward action taken.',
      };

    case 1:
      return {
        decision: 'recommend',
        effectiveAutonomyLevel: 1,
        reason: 'Agent is operating at Level 1 (Recommend). Surfacing advisory recommendation.',
      };

    case 2:
      return {
        decision: 'prepare',
        effectiveAutonomyLevel: 2,
        reason: 'Agent is operating at Level 2 (Prepare Draft). Generating draft for human review.',
      };

    case 3:
      return {
        decision: 'request_approval',
        effectiveAutonomyLevel: 3,
        reason: 'Agent is operating at Level 3 (Execute with Approval). Enqueuing to approval gate.',
      };

    case 4: {
      const minAuto = governance.minConfidenceForAutonomous ?? 85;
      if (proposedAction.confidenceScore >= minAuto) {
        return {
          decision: 'execute_autonomous',
          effectiveAutonomyLevel: 4,
          reason: `High confidence (${proposedAction.confidenceScore}% >= ${minAuto}%) enables Level 4 Governed Autonomous Execution.`,
        };
      }
      // Fallback: If confidence is high enough to prepare but below autonomous threshold, prepare draft
      return {
        decision: 'prepare',
        effectiveAutonomyLevel: 2,
        reason: `Confidence (${proposedAction.confidenceScore}%) is below autonomous threshold (${minAuto}%). Falling back to Level 2 (Prepare Draft).`,
      };
    }

    default:
      return {
        decision: 'recommend',
        effectiveAutonomyLevel: 1,
        reason: 'Default fallback to Level 1 (Recommend).',
      };
  }
}

/**
 * Computes multi-factor priority score for Next-Best-Action recommendations.
 * Priority Score = 35% Buyer Intent + 25% Deal Value + 20% Urgency/Inactivity + 20% AI Confidence.
 */
export function computeNextBestActionPriority(params: {
  dealValue: number;
  buyerSignalStrength?: 'high' | 'medium' | 'low';
  daysSinceLastActivity: number;
  confidenceScore: number;
}): PriorityScoreResult {
  const { dealValue, buyerSignalStrength, daysSinceLastActivity, confidenceScore } = params;

  // Normalized factor scores (0 - 100)
  const signalScore =
    buyerSignalStrength === 'high' ? 100 : buyerSignalStrength === 'medium' ? 65 : 30;

  // Cap value score at $50k
  const valueScore = Math.min(100, Math.max(0, (dealValue / 50000) * 100));

  // Inactivity urgency increases with days since last touch (cap at 14 days)
  const urgencyScore = Math.min(100, Math.max(0, (daysSinceLastActivity / 14) * 100));

  const clampedConfidence = Math.min(100, Math.max(0, confidenceScore));

  const compositeScore = Math.round(
    signalScore * 0.35 + valueScore * 0.25 + urgencyScore * 0.2 + clampedConfidence * 0.2
  );

  let priority: AiRecommendationPriority = 'low';
  if (compositeScore >= 75) {
    priority = 'critical';
  } else if (compositeScore >= 50) {
    priority = 'high';
  } else if (compositeScore >= 30) {
    priority = 'medium';
  }

  return { priority, compositeScore };
}

/**
 * Scans CRM deal and contact lists for data hygiene discrepancies, stale records,
 * and single-threaded enterprise opportunities. Pure and deterministic.
 */
export function detectCrmHygieneAnomalies(params: {
  deals: DealHygieneContext[];
  contacts: ContactHygieneContext[];
  workspaceId: string;
  organizationId: string;
  now?: Date;
}): AiCrmHygieneIssue[] {
  const { deals, contacts, workspaceId, organizationId } = params;
  const now = params.now ?? new Date();
  const issues: AiCrmHygieneIssue[] = [];

  // 1. Scan Deals
  for (const deal of deals) {
    if (deal.status !== 'open') continue;

    // Check Stale Deal (>14 days inactive)
    if (deal.lastActivityAt) {
      const elapsedDays =
        (now.getTime() - new Date(deal.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 14) {
        issues.push({
          id: `hygiene_stale_${deal.id}`,
          workspaceId,
          organizationId,
          issueType: 'stale_deal',
          severity: elapsedDays > 30 ? 'critical' : 'high',
          entityType: 'deal',
          entityId: deal.id,
          entityName: deal.name,
          fieldName: 'lastActivityAt',
          currentValue: deal.lastActivityAt,
          suggestedValue: 'Schedule Account Re-engagement',
          repairRationale: `Deal has been inactive for ${Math.round(elapsedDays)} days. Risk of deal slippage is elevated.`,
          status: 'detected',
          detectedAt: now.toISOString(),
        });
      }
    }

    // Check Missing Next Step
    if (!deal.nextStepDate || !deal.nextStepDescription) {
      issues.push({
        id: `hygiene_step_${deal.id}`,
        workspaceId,
        organizationId,
        issueType: 'missing_next_step',
        severity: 'medium',
        entityType: 'deal',
        entityId: deal.id,
        entityName: deal.name,
        fieldName: 'nextStepDate',
        currentValue: deal.nextStepDate ?? null,
        suggestedValue: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
        repairRationale: 'Every active opportunity must maintain an explicit next step and due date to ensure momentum.',
        status: 'detected',
        detectedAt: now.toISOString(),
      });
    }

    // Check Single-Threaded Enterprise Risk ($10k+ with <= 1 stakeholder)
    const stakeholders = deal.stakeholderCount ?? 0;
    if (deal.value >= 10000 && stakeholders <= 1) {
      issues.push({
        id: `hygiene_thread_${deal.id}`,
        workspaceId,
        organizationId,
        issueType: 'single_threaded',
        severity: deal.value >= 50000 ? 'critical' : 'high',
        entityType: 'deal',
        entityId: deal.id,
        entityName: deal.name,
        fieldName: 'stakeholderCount',
        currentValue: stakeholders,
        suggestedValue: 3,
        repairRationale: `High-value opportunity ($${deal.value.toLocaleString()}) is single-threaded. Map Economic Buyer and Technical Champion.`,
        status: 'detected',
        detectedAt: now.toISOString(),
      });
    }
  }

  // 2. Scan Contacts & Leads
  for (const contact of contacts) {
    // Unassigned Hot Lead
    const score = contact.leadScore ?? 0;
    if (!contact.assignedTo && score >= 70) {
      issues.push({
        id: `hygiene_lead_${contact.id}`,
        workspaceId,
        organizationId,
        issueType: 'unassigned_lead',
        severity: 'high',
        entityType: 'lead',
        entityId: contact.id,
        entityName: contact.name,
        fieldName: 'assignedTo',
        currentValue: null,
        suggestedValue: 'Auto-Assign via Capacity Routing',
        repairRationale: `High-intent inbound lead (Score: ${score}) has no assigned owner. Response SLA is at risk.`,
        status: 'detected',
        detectedAt: now.toISOString(),
      });
    }

    // Missing Email on Contact
    if (!contact.email || contact.email.trim() === '') {
      issues.push({
        id: `hygiene_email_${contact.id}`,
        workspaceId,
        organizationId,
        issueType: 'missing_email',
        severity: 'low',
        entityType: 'contact',
        entityId: contact.id,
        entityName: contact.name,
        fieldName: 'email',
        currentValue: null,
        suggestedValue: 'Enrich via Domain Discovery',
        repairRationale: 'Contact lacks an email address, blocking automated sequencing and calendar invites.',
        status: 'detected',
        detectedAt: now.toISOString(),
      });
    }
  }

  return issues;
}

/**
 * State machine for evaluating Human-in-the-Loop AI approval resolution.
 */
export function evaluateAiApprovalDecision(params: {
  approval: AiSalesApproval;
  decision: 'approved' | 'rejected' | 'escalated';
  reviewerId: string;
  reviewNote?: string;
  now?: Date;
}): { success: boolean; updatedApproval?: AiSalesApproval; error?: string } {
  const { approval, decision, reviewerId, reviewNote } = params;
  const now = params.now ?? new Date();

  if (approval.status !== 'pending') {
    return {
      success: false,
      error: `Approval request is already resolved with status "${approval.status}".`,
    };
  }

  const updatedApproval: AiSalesApproval = {
    ...approval,
    status: decision as AiApprovalStatus,
    reviewedBy: reviewerId,
    reviewedAt: now.toISOString(),
    reviewNote: reviewNote || `Resolved as ${decision} by ${reviewerId}`,
  };

  return { success: true, updatedApproval };
}

/**
 * Calculates aggregated AI Fleet performance, ROI, hours saved, and health index.
 */
export function calculateAiFleetMetrics(params: {
  agents: AiAgentProfile[];
  executions: AiExecutionAuditDoc[];
  approvals: AiSalesApproval[];
  recommendations: AiSalesRecommendation[];
}): AiFleetMetrics {
  const { agents, executions, approvals, recommendations } = params;

  // Total autonomous actions = executions with autonomyLevel === 4 and status === 'success'
  const autonomousActionsTotal = executions.filter(
    (e) => e.autonomyLevel === 4 && e.status === 'success'
  ).length;

  // Approximate 21 minutes (0.35 hours) saved per successful automated action or prepared brief
  const successfulExecutions = executions.filter((e) => e.status === 'success').length;
  const hoursSavedEstimate = Math.round(successfulExecutions * 0.35 * 10) / 10;

  // Human approval rate
  const resolvedApprovals = approvals.filter((a) => a.status !== 'pending');
  const approvedCount = resolvedApprovals.filter((a) => a.status === 'approved').length;
  const humanApprovalRate =
    resolvedApprovals.length > 0
      ? Math.round((approvedCount / resolvedApprovals.length) * 100)
      : 100;

  // Active recommendations
  const activeRecommendationsCount = recommendations.filter((r) => r.status === 'pending').length;

  // Health index = average accuracy score across active agents
  const activeAgents = agents.filter((a) => a.status === 'active');
  const healthIndex =
    activeAgents.length > 0
      ? Math.round(
          activeAgents.reduce((acc, a) => acc + (a.accuracyScore ?? 90), 0) / activeAgents.length
        )
      : 95;

  return {
    autonomousActionsTotal,
    hoursSavedEstimate,
    humanApprovalRate,
    activeRecommendationsCount,
    healthIndex,
    activeAgentsCount: activeAgents.length,
  };
}
