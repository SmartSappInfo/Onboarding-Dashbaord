/**
 * @fileoverview Pure AI Prioritization & Next-Best-Action Engine for Seller Workspace (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Sections 31, 32 & UI Section 14:
 * 1. Multi-factor priority score calculation (0–100 scale).
 * 2. Entity-level task and signal coalescence (R2 deduplication).
 * 3. Quota-deficit weighting (boosting items matching lagging quotas).
 * 4. Dynamic SLA countdown calculation.
 * 5. Contextual "Why?" explanation and suggested conversation talking points.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure functions with zero side effects.
 * - Zero 'any' or 'any[]' allowed.
 * - Must handle missing dates or corrupted timestamps gracefully with fallbacks.
 */

import type {
  WorkQueueItem,
  QueueItemType,
  PriorityImpact,
  PriorityUrgency,
  SlaStatus,
  PriorityScoreBreakdown,
} from './types';

export interface RawCandidateInput {
  id: string;
  type: QueueItemType;
  title: string;
  description: string;
  entityId?: string;
  entityName?: string;
  entityType?: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  dealStage?: string;
  dueDate: string;
  signalStrength?: 'high' | 'medium' | 'low';
  signalCount?: number;
  confidence?: number;
  assignedTo: string;
  workspaceId: string;
  organizationId: string;
  isManagerElevated?: boolean;
  managerNote?: string;
  suggestedAction?: string;
  createdAt?: string;
}

export interface PrioritizationContext {
  repLaggingMetric?: string; // e.g. 'meetings' or 'calls' if rep target attainment < 70%
  currentTime?: Date;
}

/**
 * Evaluates SLA status and minutes remaining from a target ISO due date.
 */
export function evaluateSlaTiming(
  dueDateStr: string,
  now: Date = new Date(),
  warningMinutesThreshold = 120
): {
  slaStatus: SlaStatus;
  minutesRemaining: number;
  badgeLabel: string;
} {
  const dueMs = new Date(dueDateStr).getTime();
  const currentMs = now.getTime();

  if (isNaN(dueMs)) {
    return {
      slaStatus: 'on_track',
      minutesRemaining: 1440,
      badgeLabel: 'Scheduled',
    };
  }

  const diffMs = dueMs - currentMs;
  const minutesRemaining = Math.round(diffMs / (60 * 1000));

  if (minutesRemaining < 0) {
    const overdueMinutes = Math.abs(minutesRemaining);
    const label =
      overdueMinutes >= 60
        ? `Overdue by ${Math.floor(overdueMinutes / 60)}h ${overdueMinutes % 60}m`
        : `Overdue by ${overdueMinutes}m`;
    return {
      slaStatus: 'breached',
      minutesRemaining,
      badgeLabel: label,
    };
  }

  if (minutesRemaining <= warningMinutesThreshold) {
    const label =
      minutesRemaining >= 60
        ? `Due in ${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m`
        : `Due in ${minutesRemaining}m`;
    return {
      slaStatus: 'at_risk',
      minutesRemaining,
      badgeLabel: label,
    };
  }

  const hoursRemaining = Math.floor(minutesRemaining / 60);
  const label =
    hoursRemaining >= 24
      ? `Due in ${Math.floor(hoursRemaining / 24)}d`
      : `Due in ${hoursRemaining}h`;

  return {
    slaStatus: 'on_track',
    minutesRemaining,
    badgeLabel: label,
  };
}

/**
 * Calculates deterministic multi-factor priority score (0–100) and priority breakdown.
 */
export function calculatePriorityScore(
  candidate: RawCandidateInput,
  context: PrioritizationContext = {}
): {
  priorityScore: number;
  impact: PriorityImpact;
  urgency: PriorityUrgency;
  confidence: number;
  breakdown: PriorityScoreBreakdown;
  reason: string;
  recommendedAction: string;
  suggestedTalkingPoint: string;
} {
  const now = context.currentTime || new Date();

  // 0. Managerial Override: Elevate to Hero takes absolute precedence (Priority 100)
  if (candidate.isManagerElevated) {
    const defaultDirective = candidate.suggestedAction || 'Mandated executive priority: initiate direct contact immediately.';
    return {
      priorityScore: 100,
      impact: 'critical',
      urgency: 'immediate',
      confidence: 99,
      breakdown: {
        baseScore: 40,
        dealValueBoost: 20,
        signalStrengthBoost: 15,
        slaUrgencyBoost: 15,
        quotaDeficitBoost: 10,
        totalScore: 100,
      },
      reason: candidate.managerNote
        ? `Manager Directive: ${candidate.managerNote}`
        : 'Elevated by Sales Leadership for immediate action.',
      recommendedAction: defaultDirective,
      suggestedTalkingPoint: '“I wanted to personally reach out to ensure we are aligned with your timeline and deliverables.”',
    };
  }

  // 1. Base Score by Item Type
  let baseScore = 25;
  if (candidate.type === 'buyer_signal') baseScore = 40;
  else if (candidate.type === 'meeting_prep') baseScore = 35;
  else if (candidate.type === 'deal_action') baseScore = 30;
  else if (candidate.type === 'call') baseScore = 28;
  else if (candidate.type === 'follow_up') baseScore = 25;

  // 2. Deal Value Boost
  let dealValueBoost = 0;
  const val = candidate.dealValue || 0;
  if (val >= 100000) dealValueBoost = 25;
  else if (val >= 50000) dealValueBoost = 15;
  else if (val >= 10000) dealValueBoost = 10;

  // 3. Buyer Signal Strength Boost
  let signalStrengthBoost = 0;
  if (candidate.signalStrength === 'high' || (candidate.signalCount && candidate.signalCount >= 3)) {
    signalStrengthBoost = 20;
  } else if (candidate.signalStrength === 'medium') {
    signalStrengthBoost = 10;
  }

  // 4. SLA Urgency Boost
  const slaResult = evaluateSlaTiming(candidate.dueDate, now);
  let slaUrgencyBoost = 0;
  if (slaResult.slaStatus === 'breached') {
    slaUrgencyBoost = 35;
  } else if (slaResult.slaStatus === 'at_risk') {
    slaUrgencyBoost = 25;
  } else if (slaResult.minutesRemaining <= 720) {
    // Due within 12 hours
    slaUrgencyBoost = 10;
  }

  // 5. Quota Deficit Boost
  let quotaDeficitBoost = 0;
  if (context.repLaggingMetric) {
    if (
      (context.repLaggingMetric === 'meetings' && candidate.type === 'meeting_prep') ||
      (context.repLaggingMetric === 'calls' && candidate.type === 'call') ||
      (context.repLaggingMetric === 'deals' && candidate.type === 'deal_action')
    ) {
      quotaDeficitBoost = 15;
    }
  }

  // Total Score clamped between [10, 100]
  const totalScore = Math.min(
    100,
    Math.max(10, baseScore + dealValueBoost + signalStrengthBoost + slaUrgencyBoost + quotaDeficitBoost)
  );

  // Derive Impact Category
  let impact: PriorityImpact = 'medium';
  if (totalScore >= 80 || dealValueBoost >= 20 || candidate.signalStrength === 'high') {
    impact = totalScore >= 90 ? 'critical' : 'high';
  } else if (totalScore < 40) {
    impact = 'low';
  }

  // Derive Urgency Category
  let urgency: PriorityUrgency = 'today';
  if (slaResult.slaStatus === 'breached' || slaResult.minutesRemaining <= 120) {
    urgency = 'immediate';
  } else if (slaResult.minutesRemaining > 1440 * 2) {
    urgency = 'this_week';
  }

  // Confidence (default 85% with signal precision)
  const confidence = candidate.confidence || (candidate.signalStrength === 'high' ? 92 : 85);

  // Formulate Contextual Reason (PRD Section 32)
  let reason = 'Scheduled follow-up due in today’s queue.';
  if (candidate.type === 'buyer_signal') {
    const times = candidate.signalCount ? `${candidate.signalCount}×` : 'repeatedly';
    reason = `High-intent buyer engagement: Viewed materials ${times} with active interest.`;
  } else if (slaResult.slaStatus === 'breached') {
    reason = `SLA breached: Lead response window expired ${slaResult.badgeLabel.toLowerCase()}. Immediate outreach required.`;
  } else if (slaResult.slaStatus === 'at_risk') {
    reason = `SLA alert: Window expires soon (${slaResult.badgeLabel}). Prioritize before escalation.`;
  } else if (candidate.type === 'meeting_prep') {
    reason = `Upcoming meeting: Decision maker session requires agenda and proposal review.`;
  } else if (val >= 50000) {
    reason = `High-value pipeline opportunity (${val.toLocaleString()} GHS): Needs proactive momentum.`;
  }

  // Formulate Recommended Action
  let recommendedAction = 'Contact lead to advance opportunity discussion.';
  if (candidate.type === 'call') {
    recommendedAction = 'Call prospect to confirm requirements and next steps.';
  } else if (candidate.type === 'meeting_prep') {
    recommendedAction = 'Review prospect notes and prepare discussion topics.';
  } else if (candidate.type === 'follow_up') {
    recommendedAction = 'Send personalized follow-up addressing outstanding questions.';
  } else if (candidate.type === 'deal_action') {
    recommendedAction = 'Review proposal feedback and schedule deal review.';
  }

  // Suggested Talking Point
  let suggestedTalkingPoint = 'Confirm implementation timeline and verify decision-maker availability.';
  if (candidate.type === 'buyer_signal') {
    suggestedTalkingPoint = '“I noticed you were reviewing our implementation proposal—did you have any questions on the deployment timeline?”';
  } else if (candidate.type === 'meeting_prep') {
    suggestedTalkingPoint = '“To make the most of our time today, let’s focus on your core objectives and integration schedule.”';
  }

  return {
    priorityScore: totalScore,
    impact,
    urgency,
    confidence,
    breakdown: {
      baseScore,
      dealValueBoost,
      signalStrengthBoost,
      slaUrgencyBoost,
      quotaDeficitBoost,
      totalScore,
    },
    reason,
    recommendedAction,
    suggestedTalkingPoint,
  };
}

/**
 * Coalesces and deduplicates raw candidate tasks and buyer signals into unified WorkQueueItems.
 * Resolves Failure Mode R2 (preventing disjoint duplicate cards for the same account).
 */
export function coalesceAndRankQueue(
  candidates: RawCandidateInput[],
  context: PrioritizationContext = {}
): WorkQueueItem[] {
  const entityMap = new Map<string, RawCandidateInput>();

  // Pass 1: Deduplicate / Coalesce by entityId or dealId
  for (const c of candidates) {
    const key = c.entityId ? `entity_${c.entityId}` : c.dealId ? `deal_${c.dealId}` : `item_${c.id}`;

    const existing = entityMap.get(key);
    if (!existing) {
      entityMap.set(key, { ...c });
    } else {
      // Merge context: prefer signal strength and higher urgency
      const mergedSignalStrength =
        existing.signalStrength === 'high' || c.signalStrength === 'high'
          ? 'high'
          : existing.signalStrength || c.signalStrength;

      const mergedSignalCount = (existing.signalCount || 0) + (c.signalCount || 0);

      // Keep earlier due date
      const existingDue = new Date(existing.dueDate).getTime();
      const newDue = new Date(c.dueDate).getTime();
      const earlierDue = !isNaN(newDue) && newDue < existingDue ? c.dueDate : existing.dueDate;

      entityMap.set(key, {
        ...existing,
        // Upgrade title if one is a buyer signal
        title: existing.type === 'buyer_signal' ? existing.title : c.title,
        description: `${existing.description} • ${c.description}`,
        signalStrength: mergedSignalStrength,
        signalCount: mergedSignalCount > 0 ? mergedSignalCount : undefined,
        dealValue: existing.dealValue || c.dealValue,
        dealName: existing.dealName || c.dealName,
        dueDate: earlierDue,
      });
    }
  }

  // Pass 2: Score and construct WorkQueueItems
  const rankedItems: WorkQueueItem[] = [];

  for (const item of entityMap.values()) {
    const scoreData = calculatePriorityScore(item, context);
    const sla = evaluateSlaTiming(item.dueDate, context.currentTime);

    rankedItems.push({
      id: item.id,
      workspaceId: item.workspaceId,
      organizationId: item.organizationId,
      assignedTo: item.assignedTo,
      type: item.type,
      title: item.title,
      description: item.description,
      entityId: item.entityId,
      entityName: item.entityName,
      entityType: item.entityType,
      contactId: item.contactId,
      contactName: item.contactName,
      contactPhone: item.contactPhone,
      contactEmail: item.contactEmail,
      dealId: item.dealId,
      dealName: item.dealName,
      dealValue: item.dealValue,
      dealStage: item.dealStage,
      priorityScore: scoreData.priorityScore,
      scoreBreakdown: scoreData.breakdown,
      impact: scoreData.impact,
      urgency: scoreData.urgency,
      confidence: scoreData.confidence,
      reason: scoreData.reason,
      recommendedAction: scoreData.recommendedAction,
      suggestedTalkingPoint: scoreData.suggestedTalkingPoint,
      slaStatus: sla.slaStatus,
      slaDueAt: item.dueDate,
      dueDate: item.dueDate,
      status: 'pending',
      createdAt: item.createdAt || new Date().toISOString(),
    });
  }

  // Pass 3: Sort by priorityScore descending, then dueDate ascending
  return rankedItems.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}
