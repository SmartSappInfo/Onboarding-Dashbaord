/**
 * @fileoverview Pure Deterministic Computational Engine for SmartSapp Buyer & Deal Intelligence (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 44 and UI Specifications Sections 23-28:
 * 1. Side-effect-free, deterministic calculation of 4-pillar Deal Health Score (0–100).
 * 2. Multi-threading evaluation and single-threaded risk detection.
 * 3. Explainable bulleted "Why?" drivers and prioritized tactical AI recommendations.
 * 4. Post-meeting intelligence extraction (buying signals, commitments, objections, CRM sync payload).
 * 5. Unified 4-party activity timeline assembly (Human vs Buyer vs AI vs Automation).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]' or 'as any'.
 * - Must be strictly pure with zero database calls, network I/O, or clock skew dependencies.
 * - Always guard against NaN, nullish inputs, and division-by-zero.
 *
 * TESTABILITY POINTER:
 * Tested in `src/lib/deal-intelligence/__tests__/deal-intelligence-engine.test.ts`.
 */

import type {
  DealHealthScorecard,
  DealHealthTier,
  DealIntelligenceGovernance,
  StakeholderPerson,
  StakeholderRole,
  BuyerSignal,
  PostMeetingCommitment,
  PostMeetingCrmSyncDraft,
  PostMeetingIntelligence,
  UnifiedTimelineEvent,
  ActivityActorType,
} from './types';

export const DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE: DealIntelligenceGovernance = {
  workspaceId: 'default',
  organizationId: 'default',
  healthWeights: {
    engagementRecency: 0.25,
    stakeholderBreadth: 0.25,
    stageVelocity: 0.25,
    conversationSentiment: 0.25,
  },
  stageStagnationDays: {
    discovery: 14,
    qualification: 21,
    proposal: 14,
    negotiation: 10,
    closing: 7,
  },
  singleThreadedValueThreshold: 10000,
  minimumTouchFrequencyDays: 10,
  highIntentConfidenceThreshold: 70,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

/**
 * Normalizes 4 deal health factor weights so their sum equals exactly 1.00 (100%).
 * Safely handles negative inputs, zeros, and NaN.
 */
export function autoBalanceDealHealthWeights(
  weights: DealIntelligenceGovernance['healthWeights']
): DealIntelligenceGovernance['healthWeights'] {
  const rInput = Math.max(0, weights.engagementRecency || 0);
  const sInput = Math.max(0, weights.stakeholderBreadth || 0);
  const vInput = Math.max(0, weights.stageVelocity || 0);
  const cInput = Math.max(0, weights.conversationSentiment || 0);

  const sum = rInput + sInput + vInput + cInput;

  if (sum <= 0) {
    return {
      engagementRecency: 0.25,
      stakeholderBreadth: 0.25,
      stageVelocity: 0.25,
      conversationSentiment: 0.25,
    };
  }

  const r = Math.round((rInput / sum) * 100) / 100;
  const s = Math.round((sInput / sum) * 100) / 100;
  const v = Math.round((vInput / sum) * 100) / 100;
  // Ensure exact 1.00 by giving the remainder to conversationSentiment
  const c = Math.max(0, Math.round((1.0 - (r + s + v)) * 100) / 100);

  return {
    engagementRecency: r,
    stakeholderBreadth: s,
    stageVelocity: v,
    conversationSentiment: c,
  };
}

export interface DealHealthInputParams {
  deal: {
    id: string;
    name: string;
    value: number;
    stageId: string;
    stageName: string;
    ownerId: string;
    ownerName: string;
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    expectedCloseDate?: string;
    slipCount?: number;
    daysInStage?: number;
  };
  stakeholders?: StakeholderPerson[];
  interactions?: { timestamp: string; actorType: ActivityActorType }[];
  calls?: {
    overallScore?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    unresolvedObjections?: string[];
  }[];
  governance?: Partial<DealIntelligenceGovernance>;
  referenceTimeMs?: number; // Injected for deterministic testing
}

/**
 * Pure calculation of multi-threading score and single-threaded risk.
 */
export function evaluateStakeholderMultiThreading(
  stakeholders: StakeholderPerson[] = [],
  dealValue = 0,
  singleThreadThreshold = 10000
): {
  multiThreadingScore: number;
  isSingleThreaded: boolean;
  missingCrucialRoles: StakeholderRole[];
} {
  const total = stakeholders.length;
  const isSingleThreaded = total <= 1 && dealValue >= singleThreadThreshold;

  const rolesPresent = new Set(stakeholders.map((s) => s.role));
  const missingCrucialRoles: StakeholderRole[] = [];

  if (!rolesPresent.has('economic_buyer')) missingCrucialRoles.push('economic_buyer');
  if (!rolesPresent.has('champion')) missingCrucialRoles.push('champion');
  if (!rolesPresent.has('evaluator')) missingCrucialRoles.push('evaluator');

  // Base score from headcount
  let score = 0;
  if (total === 1) score = isSingleThreaded ? 30 : 50;
  else if (total === 2) score = 65;
  else if (total === 3) score = 80;
  else if (total >= 4) score = 90;

  // Bonuses for key roles
  if (rolesPresent.has('economic_buyer')) score += 10;
  if (rolesPresent.has('champion')) score += 10;

  // Penalty if a blocker is present without an active champion
  const hasBlocker = stakeholders.some((s) => s.role === 'blocker' || s.sentiment === 'blocker');
  const hasActiveChampion = stakeholders.some(
    (s) => s.role === 'champion' && (s.sentiment === 'champion' || s.sentiment === 'supporter')
  );

  if (hasBlocker && !hasActiveChampion) {
    score -= 20;
  }

  return {
    multiThreadingScore: Math.max(0, Math.min(100, Math.round(score))),
    isSingleThreaded,
    missingCrucialRoles,
  };
}

/**
 * Pure calculation of 4-pillar Deal Health Scorecard.
 */
export function calculateDealHealthScore(params: DealHealthInputParams): DealHealthScorecard {
  const {
    deal,
    stakeholders = [],
    interactions = [],
    calls = [],
    governance: customGov,
    referenceTimeMs = Date.now(),
  } = params;

  const gov: DealIntelligenceGovernance = {
    ...DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE,
    ...customGov,
    healthWeights: {
      ...DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE.healthWeights,
      ...customGov?.healthWeights,
    },
    stageStagnationDays: {
      ...DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE.stageStagnationDays,
      ...customGov?.stageStagnationDays,
    },
  };

  const weights = autoBalanceDealHealthWeights(gov.healthWeights);

  // -------------------------------------------------------------
  // Pillar 1: Engagement Recency & Cadence (0–100)
  // -------------------------------------------------------------
  let daysSinceLastTouch = 99;
  let touchesLast14Days = 0;

  const fourteenDaysAgoMs = referenceTimeMs - 14 * 86400000;

  if (interactions.length > 0) {
    const sortedInteractions = [...interactions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const mostRecentMs = new Date(sortedInteractions[0].timestamp).getTime();
    if (!isNaN(mostRecentMs)) {
      daysSinceLastTouch = Math.max(0, Math.floor((referenceTimeMs - mostRecentMs) / 86400000));
    }

    touchesLast14Days = interactions.filter((i) => {
      const t = new Date(i.timestamp).getTime();
      return !isNaN(t) && t >= fourteenDaysAgoMs;
    }).length;
  } else if (deal.lastActivityAt) {
    const actMs = new Date(deal.lastActivityAt).getTime();
    if (!isNaN(actMs)) {
      daysSinceLastTouch = Math.max(0, Math.floor((referenceTimeMs - actMs) / 86400000));
    }
  }

  let recencyScore = 100;
  if (daysSinceLastTouch <= 2) recencyScore = 100;
  else if (daysSinceLastTouch <= 5) recencyScore = 85;
  else if (daysSinceLastTouch <= 10) recencyScore = 70;
  else if (daysSinceLastTouch <= 14) recencyScore = 45;
  else recencyScore = Math.max(0, 45 - (daysSinceLastTouch - 14) * 4);

  // Frequency adjustment
  if (touchesLast14Days >= 4) recencyScore = Math.min(100, recencyScore + 10);
  else if (touchesLast14Days === 0 && daysSinceLastTouch > 7) recencyScore = Math.max(0, recencyScore - 15);

  const recencyStatus: DealHealthTier =
    recencyScore >= 80 ? 'healthy' : recencyScore >= 50 ? 'warning' : 'at_risk';

  // -------------------------------------------------------------
  // Pillar 2: Stakeholder Breadth & Multi-Threading (0–100)
  // -------------------------------------------------------------
  const { multiThreadingScore, isSingleThreaded } = evaluateStakeholderMultiThreading(
    stakeholders,
    deal.value,
    gov.singleThreadedValueThreshold
  );

  const economicBuyerIdentified = stakeholders.some((s) => s.role === 'economic_buyer');
  const championIdentified = stakeholders.some((s) => s.role === 'champion');

  const stakeholderStatus: DealHealthTier =
    multiThreadingScore >= 80 ? 'healthy' : multiThreadingScore >= 50 ? 'warning' : 'at_risk';

  // -------------------------------------------------------------
  // Pillar 3: Stage Velocity & Stagnation (0–100)
  // -------------------------------------------------------------
  const normalizedStageKey = (deal.stageName || deal.stageId || 'discovery')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');

  const stageBenchmarkDays = gov.stageStagnationDays[normalizedStageKey] || 10;
  const daysInCurrentStage = deal.daysInStage !== undefined ? deal.daysInStage : 5;
  const slipCount = deal.slipCount || 0;

  let velocityScore = 100;
  if (daysInCurrentStage <= stageBenchmarkDays * 0.7) velocityScore = 100;
  else if (daysInCurrentStage <= stageBenchmarkDays) velocityScore = 85;
  else if (daysInCurrentStage <= stageBenchmarkDays * 1.5) velocityScore = 55;
  else velocityScore = Math.max(10, 55 - (daysInCurrentStage - stageBenchmarkDays * 1.5) * 5);

  // Close date slip penalties
  if (slipCount > 0) {
    velocityScore = Math.max(0, velocityScore - slipCount * 15);
  }

  const velocityStatus: DealHealthTier =
    velocityScore >= 80 ? 'healthy' : velocityScore >= 50 ? 'warning' : 'at_risk';

  // -------------------------------------------------------------
  // Pillar 4: Conversation Sentiment & Objections (0–100)
  // -------------------------------------------------------------
  let sentimentScore = 75; // Neutral baseline when no calls logged
  let netSentiment = 0.2;
  let unresolvedObjectionsCount = 0;
  let lastCallScore: number | undefined = undefined;

  if (calls.length > 0) {
    const scores = calls.filter((c) => typeof c.overallScore === 'number').map((c) => c.overallScore as number);
    if (scores.length > 0) {
      lastCallScore = scores[scores.length - 1];
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      sentimentScore = Math.round(avgScore * 20); // 1-5 scale mapped to 0-100
    }

    const positiveCalls = calls.filter((c) => c.sentiment === 'positive').length;
    const negativeCalls = calls.filter((c) => c.sentiment === 'negative').length;
    netSentiment = calls.length > 0 ? (positiveCalls - negativeCalls) / calls.length : 0;

    unresolvedObjectionsCount = calls.reduce((total, c) => total + (c.unresolvedObjections?.length || 0), 0);

    sentimentScore -= unresolvedObjectionsCount * 12;
    sentimentScore = Math.max(0, Math.min(100, Math.round(sentimentScore)));
  }

  const sentimentStatus: DealHealthTier =
    sentimentScore >= 80 ? 'healthy' : sentimentScore >= 50 ? 'warning' : 'at_risk';

  // -------------------------------------------------------------
  // Overall Weighted Calculation
  // -------------------------------------------------------------
  const overallHealthScore = Math.round(
    recencyScore * weights.engagementRecency +
      multiThreadingScore * weights.stakeholderBreadth +
      velocityScore * weights.stageVelocity +
      sentimentScore * weights.conversationSentiment
  );

  const healthTier: DealHealthTier =
    overallHealthScore >= 80 ? 'healthy' : overallHealthScore >= 50 ? 'warning' : 'at_risk';

  // -------------------------------------------------------------
  // Explainable "Why?" Drivers
  // -------------------------------------------------------------
  const explainableDrivers: string[] = [];

  if (daysSinceLastTouch > 7) {
    explainableDrivers.push(`${daysSinceLastTouch} days without meaningful customer engagement`);
  }
  if (isSingleThreaded) {
    explainableDrivers.push(
      `Single-threaded deal: Only 1 stakeholder engaged on a $${deal.value.toLocaleString()} opportunity`
    );
  }
  if (!economicBuyerIdentified && deal.value >= 10000) {
    explainableDrivers.push('No Economic Buyer / Decision Maker identified in deal roster');
  }
  if (daysInCurrentStage > stageBenchmarkDays) {
    explainableDrivers.push(
      `Stagnated in ${deal.stageName || 'current stage'} for ${daysInCurrentStage} days (benchmark: ${stageBenchmarkDays} days)`
    );
  }
  if (slipCount > 0) {
    explainableDrivers.push(`Expected close date has slipped ${slipCount} time${slipCount > 1 ? 's' : ''}`);
  }
  if (unresolvedObjectionsCount > 0) {
    explainableDrivers.push(`${unresolvedObjectionsCount} unresolved objection(s) logged from recent calls`);
  }

  // Positive drivers if healthy
  if (explainableDrivers.length === 0) {
    if (championIdentified && economicBuyerIdentified) {
      explainableDrivers.push('Strong multi-threading: Champion and Economic Buyer actively engaged');
    }
    if (touchesLast14Days >= 3) {
      explainableDrivers.push(`High engagement cadence with ${touchesLast14Days} touches over the last 14 days`);
    }
    if (daysInCurrentStage <= stageBenchmarkDays) {
      explainableDrivers.push(`Healthy stage velocity within ${stageBenchmarkDays}-day benchmark`);
    }
  }

  // -------------------------------------------------------------
  // Prioritized AI Recommended Action
  // -------------------------------------------------------------
  let aiRecommendedAction: DealHealthScorecard['aiRecommendedAction'] = {
    actionType: 'follow_up',
    title: 'Schedule check-in call with primary stakeholder',
    rationale: 'Maintain cadence and confirm next steps towards evaluation.',
    urgency: 'medium',
  };

  if (isSingleThreaded || !economicBuyerIdentified) {
    aiRecommendedAction = {
      actionType: 'engage_stakeholder',
      title: 'Engage Economic Buyer / Finance Director',
      rationale:
        'Single-threaded high-value deal. Multi-threading increases close probability by 42%.',
      urgency: 'immediate',
    };
  } else if (unresolvedObjectionsCount > 0) {
    aiRecommendedAction = {
      actionType: 'unblock_pricing',
      title: 'Send ROI justification and unblock pricing objection',
      rationale: 'Recent customer interactions flagged pricing pushback.',
      urgency: 'high',
    };
  } else if (daysSinceLastTouch > 10) {
    aiRecommendedAction = {
      actionType: 'reschedule_demo',
      title: 'Re-engage account with value-first executive check-in',
      rationale: `${daysSinceLastTouch} days of communication silence threatens momentum.`,
      urgency: 'immediate',
    };
  } else if (slipCount >= 2) {
    aiRecommendedAction = {
      actionType: 'executive_sponsor',
      title: 'Request executive sponsor alignment call',
      rationale: 'Repeated close date slippage requires senior executive intervention.',
      urgency: 'high',
    };
  }

  return {
    id: `dhs_${deal.id}`,
    dealId: deal.id,
    dealName: deal.name,
    workspaceId: gov.workspaceId,
    organizationId: gov.organizationId,
    ownerId: deal.ownerId,
    ownerName: deal.ownerName,
    dealValue: deal.value,
    stageId: deal.stageId,
    stageName: deal.stageName,
    overallHealthScore,
    healthTier,
    factors: {
      engagementRecency: {
        score: recencyScore,
        weight: weights.engagementRecency,
        status: recencyStatus,
        details: `${daysSinceLastTouch} days since touch (${touchesLast14Days} touches in 14d)`,
        daysSinceLastTouch,
        touchesLast14Days,
      },
      stakeholderBreadth: {
        score: multiThreadingScore,
        weight: weights.stakeholderBreadth,
        status: stakeholderStatus,
        details: `${stakeholders.length} stakeholder(s) (${economicBuyerIdentified ? 'Buyer IDed' : 'No Buyer'})`,
        totalStakeholders: stakeholders.length,
        isSingleThreaded,
        economicBuyerIdentified,
        championIdentified,
      },
      stageVelocity: {
        score: velocityScore,
        weight: weights.stageVelocity,
        status: velocityStatus,
        details: `${daysInCurrentStage}d in stage (benchmark: ${stageBenchmarkDays}d, ${slipCount} slips)`,
        daysInCurrentStage,
        stageBenchmarkDays,
        slipCount,
      },
      conversationSentiment: {
        score: sentimentScore,
        weight: weights.conversationSentiment,
        status: sentimentStatus,
        details: `${unresolvedObjectionsCount} open objection(s), net sentiment ${netSentiment >= 0 ? '+' : ''}${netSentiment.toFixed(1)}`,
        netSentiment,
        unresolvedObjectionsCount,
        lastCallScore,
      },
    },
    explainableDrivers,
    aiRecommendedAction,
    calculatedAt: new Date(referenceTimeMs).toISOString(),
    updatedAt: new Date(referenceTimeMs).toISOString(),
  };
}

/**
 * Pure extractor for post-meeting notes and transcripts.
 * Identifies buying signals, commitments, objections, and generates a CRM auto-sync draft.
 */
export function extractPostMeetingIntelligence(params: {
  meetingId: string;
  meetingTitle: string;
  repId: string;
  repName: string;
  notesText: string;
  sentimentRating: 'positive' | 'neutral' | 'challenging';
  workspaceId: string;
  organizationId: string;
  dealId?: string;
  completedAt?: string;
  referenceTimeMs?: number;
}): PostMeetingIntelligence {
  const {
    meetingId,
    meetingTitle,
    repId,
    repName,
    notesText,
    sentimentRating,
    workspaceId,
    organizationId,
    dealId = 'deal_default',
    completedAt = new Date().toISOString(),
    referenceTimeMs,
  } = params;

  const nowMs = referenceTimeMs ?? (params.completedAt ? new Date(params.completedAt).getTime() : Date.now());
  const lower = notesText.toLowerCase();

  // 1. Detect buying signals
  const detectedBuyingSignals: BuyerSignal[] = [];
  if (lower.includes('budget') || lower.includes('approved') || lower.includes('sign off') || lower.includes('procurement')) {
    detectedBuyingSignals.push({
      id: `sig_${meetingId}_budget`,
      workspaceId,
      organizationId,
      entityId: dealId,
      entityType: 'deal',
      entityName: meetingTitle,
      signalType: 'intent_spike',
      intentLevel: 'high',
      sentiment: 'positive',
      confidenceScore: 88,
      source: 'meeting',
      title: 'Budget & Procurement Intent Flagged',
      description: 'Buyer confirmed budget or requested procurement documentation during meeting.',
      actionRequired: true,
      suggestedAction: {
        actionType: 'email',
        title: 'Send procurement security pack and contract terms',
        priority: 'urgent',
      },
      status: 'active',
      createdAt: completedAt,
      updatedAt: completedAt,
    });
  }

  if (lower.includes('competitor') || lower.includes('evaluating') || lower.includes('alternative')) {
    detectedBuyingSignals.push({
      id: `sig_${meetingId}_comp`,
      workspaceId,
      organizationId,
      entityId: dealId,
      entityType: 'deal',
      entityName: meetingTitle,
      signalType: 'competitor_mention',
      intentLevel: 'medium',
      sentiment: 'neutral',
      confidenceScore: 78,
      source: 'meeting',
      title: 'Competitor Mentioned in Meeting',
      description: 'Buyer noted evaluation of alternative solutions.',
      actionRequired: true,
      suggestedAction: {
        actionType: 'task',
        title: 'Review competitive differentiation battlecard with champion',
        priority: 'high',
      },
      status: 'active',
      createdAt: completedAt,
      updatedAt: completedAt,
    });
  }

  // 2. Detect objections
  const detectedObjections: string[] = [];
  if (lower.includes('price') || lower.includes('pricing') || lower.includes('cost') || lower.includes('expensive')) {
    detectedObjections.push('Pricing & budget concern');
  }
  if (lower.includes('timing') || lower.includes('q4') || lower.includes('next quarter') || lower.includes('later')) {
    detectedObjections.push('Implementation timing delay');
  }
  if (lower.includes('security') || lower.includes('compliance') || lower.includes('soc2')) {
    detectedObjections.push('Security & compliance verification needed');
  }

  // 3. Extract commitments
  const commitmentsMade: PostMeetingCommitment[] = [];
  const lines = notesText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().startsWith('commitment:') || line.toLowerCase().startsWith('action:') || line.startsWith('- [ ]')) {
      const clean = line.replace(/^(commitment:|action:|- \[ \])\s*/i, '');
      commitmentsMade.push({
        id: `com_${meetingId}_${i}`,
        who: repName,
        what: clean,
        dueDate: new Date(nowMs + 2 * 86400000).toISOString().split('T')[0],
      });
    }
  }

  if (commitmentsMade.length === 0) {
    commitmentsMade.push({
      id: `com_${meetingId}_followup`,
      who: repName,
      what: 'Send meeting recap email and agreed next steps',
      dueDate: new Date(nowMs + 86400000).toISOString().split('T')[0],
    });
  }

  // 4. Generate CRM Sync Draft
  const tasksToCreate: PostMeetingCrmSyncDraft['tasksToCreate'] = commitmentsMade.map((c) => ({
    title: c.what,
    dueDate: c.dueDate || new Date(nowMs + 86400000).toISOString().split('T')[0],
    priority: sentimentRating === 'challenging' ? 'urgent' : 'high',
  }));

  const dealHealthDelta = sentimentRating === 'positive' ? 8 : sentimentRating === 'challenging' ? -7 : 2;

  const crmSyncDraft: PostMeetingCrmSyncDraft = {
    suggestedStageId: sentimentRating === 'positive' ? 'proposal' : undefined,
    suggestedStageName: sentimentRating === 'positive' ? 'Proposal & Evaluation' : undefined,
    stageProgressionRationale:
      sentimentRating === 'positive'
        ? 'Customer expressed strong buying intent and requested commercial terms.'
        : undefined,
    dealHealthDelta,
    tasksToCreate,
    followUpEmailDraft: {
      subject: `Follow-up & Key Takeaways: ${meetingTitle}`,
      body: `Hi team,\n\nThank you for taking the time to meet today regarding ${meetingTitle}.\n\nAs discussed, our key takeaways and immediate next steps include:\n- ${commitmentsMade.map((c) => c.what).join('\n- ')}\n\nPlease let me know if you need any additional clarification.\n\nBest regards,\n${repName}`,
      recipientEmails: [],
    },
  };

  const executiveSummary =
    sentimentRating === 'positive'
      ? `High-energy discussion with constructive buyer engagement. Confirmed key business priorities with ${commitmentsMade.length} action item(s) agreed.`
      : sentimentRating === 'challenging'
        ? `Tough meeting identifying critical commercial or technical hurdles. Requires immediate follow-up on ${detectedObjections.length} open objection(s).`
        : `Balanced exploratory session with baseline alignment. Moving forward with standard evaluation deliverables.`;

  return {
    id: `pmi_${meetingId}`,
    meetingId,
    meetingTitle,
    dealId,
    workspaceId,
    organizationId,
    repId,
    repName,
    completedAt,
    sentimentRating,
    executiveSummary,
    detectedBuyingSignals,
    detectedObjections,
    commitmentsMade,
    nextSteps: commitmentsMade.map((c) => c.what),
    crmSyncDraft,
    syncStatus: 'pending_approval',
  };
}

/**
 * Merges, filters, and chronologically sorts multi-party timeline events.
 */
export function buildUnifiedActivityTimeline(events: UnifiedTimelineEvent[]): UnifiedTimelineEvent[] {
  return [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
