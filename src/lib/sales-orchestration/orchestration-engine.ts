/**
 * @fileoverview Pure Deterministic Computational Engine for Sales Orchestration & Governance (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain F / Phase 8:
 * - Deterministic trigger evaluation and condition filtering.
 * - Cascade depth limitation (MAX_CASCADE_DEPTH = 3) to prevent feedback loops.
 * - Concurrency-safe, mathematically bounded workload and capacity routing.
 * - SLA breach and escalation matrix evaluation.
 * - Human-in-the-loop approval state transitions and auto-escalation timer checks.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - This engine is 100% PURE: zero I/O, zero network, zero Firestore calls, zero Date.now() side effects.
 * - Current timestamp is always passed explicitly as `now: Date` to guarantee deterministic Vitest testability.
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 *
 * @testability Comprehensive unit tests in `src/lib/sales-orchestration/__tests__/orchestration-engine.test.ts`.
 */

import type {
  SalesPlay,
  PlayTrigger,
  PlayCondition,
  PlayExecutionInstance,
  PlayStep,
  PlayStepExecutionLog,
  RoutingRule,
  RepRoutingConfig,
  EscalationRule,
  EscalationIncident,
  ApprovalRequest,
  ApprovalStatus,
  SalesOrchestrationGovernance,
  PlayTriggerType,
} from './types';

export const MAX_CASCADE_DEPTH = 3;
export const DEFAULT_REENTRY_COOLDOWN_HOURS = 24;

export interface TriggerEvaluationEvent {
  triggerType: PlayTriggerType;
  entityType: 'deal' | 'lead' | 'contact';
  entityId: string;
  cascadeDepth?: number;
  value?: number;
  stage?: string;
  signalType?: string;
}

export interface EntityEvaluationContext {
  id: string;
  name: string;
  type: 'deal' | 'lead' | 'contact';
  value?: number;
  stage?: string;
  stakeholderCount?: number;
  leadScore?: number;
  slipCount?: number;
  healthScore?: number;
  assignedTo?: string;
  assignedToName?: string;
  createdAt?: string;
  lastActivityAt?: string;
}

export interface RoutingEvaluationResult {
  assignedRep: RepRoutingConfig | null;
  strategyUsed: RoutingRule['strategy'];
  isFallback: boolean;
  reason: string;
}

export interface SlaBreachEvaluationResult {
  breached: boolean;
  ruleId: string;
  ruleName: string;
  severity: EscalationRule['severity'];
  triggerReason: string;
}

/**
 * Generates an idempotency fingerprint key to prevent duplicate play triggers.
 */
export function generateIdempotencyKey(
  playId: string,
  entityId: string,
  triggerType: PlayTriggerType,
  windowHour: string
): string {
  return `play_${playId}_${entityId}_${triggerType}_${windowHour}`;
}

/**
 * Evaluates whether an individual play condition is satisfied by the entity.
 */
export function evaluateCondition(
  condition: PlayCondition,
  entity: EntityEvaluationContext
): boolean {
  let rawValue: string | number | undefined;

  switch (condition.field) {
    case 'deal_value':
      rawValue = entity.value ?? 0;
      break;
    case 'deal_stage':
      rawValue = entity.stage ?? '';
      break;
    case 'stakeholder_count':
      rawValue = entity.stakeholderCount ?? 0;
      break;
    case 'lead_score':
      rawValue = entity.leadScore ?? 0;
      break;
    case 'slip_count':
      rawValue = entity.slipCount ?? 0;
      break;
    case 'health_score':
      rawValue = entity.healthScore ?? 0;
      break;
    default:
      return false;
  }

  const condVal = condition.value;

  switch (condition.operator) {
    case 'equals':
      return rawValue === condVal;
    case 'not_equals':
      return rawValue !== condVal;
    case 'greater_than':
      return typeof rawValue === 'number' && typeof condVal === 'number' && rawValue > condVal;
    case 'less_than':
      return typeof rawValue === 'number' && typeof condVal === 'number' && rawValue < condVal;
    case 'in':
      if (Array.isArray(condVal)) {
        return condVal.includes(String(rawValue));
      }
      return false;
    case 'not_in':
      if (Array.isArray(condVal)) {
        return !condVal.includes(String(rawValue));
      }
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates active plays against an incoming event and entity context.
 * Enforces circuit breaker, condition matching, cascade depth limits, and re-entry cooldowns.
 */
export function evaluatePlayTriggers(
  event: TriggerEvaluationEvent,
  plays: SalesPlay[],
  entity: EntityEvaluationContext,
  existingExecutions: PlayExecutionInstance[],
  governance: SalesOrchestrationGovernance,
  now: Date
): SalesPlay[] {
  // 1. Circuit Breaker: If emergency kill switch is active, immediately halt all triggers
  if (governance.emergencyKillSwitch) {
    return [];
  }

  // 2. Cascade Depth Limit: Guard against infinite loop feedback storms
  const currentCascadeDepth = event.cascadeDepth ?? 0;
  const maxAllowedDepth = governance.maxCascadeDepth ?? MAX_CASCADE_DEPTH;
  if (currentCascadeDepth >= maxAllowedDepth) {
    return [];
  }

  const eligiblePlays: SalesPlay[] = [];

  for (const play of plays) {
    // Must be enabled and have steps
    if (!play.enabled || !play.steps || play.steps.length === 0) {
      continue;
    }

    // 3. Match at least one trigger
    const triggerMatches = play.triggers.some((trig: PlayTrigger) => {
      if (trig.type !== event.triggerType) {
        return false;
      }
      if (trig.thresholdValue !== undefined && event.value !== undefined) {
        if (event.value < trig.thresholdValue) return false;
      }
      if (trig.targetStage && event.stage) {
        if (trig.targetStage !== event.stage) return false;
      }
      if (trig.signalType && event.signalType) {
        if (trig.signalType !== event.signalType) return false;
      }
      return true;
    });

    if (!triggerMatches) {
      continue;
    }

    // 4. Verify all conditions pass
    const allConditionsPass = play.conditions.every((cond: PlayCondition) =>
      evaluateCondition(cond, entity)
    );
    if (!allConditionsPass) {
      continue;
    }

    // 5. Re-entry Debounce Verification
    const executionsForPlay = existingExecutions.filter(
      (e) => e.playId === play.id && e.entityId === entity.id
    );

    if (executionsForPlay.length > 0) {
      // If an execution is currently active, block re-entry to avoid simultaneous overlapping runs
      if (executionsForPlay.some((e) => e.status === 'active')) {
        continue;
      }

      if (!play.allowReentry) {
        // Disallow re-entry entirely if already triggered
        continue;
      }

      // Check re-entry cooldown
      const cooldownHours = play.reentryCooldownHours ?? DEFAULT_REENTRY_COOLDOWN_HOURS;
      const latestExecution = executionsForPlay.reduce((latest, current) => {
        return new Date(current.startedAt).getTime() > new Date(latest.startedAt).getTime()
          ? current
          : latest;
      }, executionsForPlay[0]);

      const referenceTime =
        latestExecution.completedAt ||
        latestExecution.lastStepExecutedAt ||
        latestExecution.startedAt;
      const elapsedHours =
        (now.getTime() - new Date(referenceTime).getTime()) / (1000 * 60 * 60);

      if (elapsedHours < cooldownHours) {
        // Still within debounce cooldown window
        continue;
      }
    }

    eligiblePlays.push(play);
  }

  return eligiblePlays;
}

/**
 * Initializes a new PlayExecutionInstance.
 */
export function createPlayExecutionInstance(
  play: SalesPlay,
  entity: EntityEvaluationContext,
  triggeredBy: 'system' | 'signal' | 'user' | 'manager',
  triggerType: PlayTriggerType,
  cascadeDepth: number,
  now: Date
): PlayExecutionInstance {
  const windowHour = now.toISOString().slice(0, 13);
  const idempotencyKey = generateIdempotencyKey(play.id, entity.id, triggerType, windowHour);

  const firstStep: PlayStep | undefined = play.steps[0];
  const delayMs = (firstStep?.delayHours ?? 0) * 3600 * 1000;
  const nextStepDueAt = new Date(now.getTime() + delayMs).toISOString();

  return {
    id: idempotencyKey,
    workspaceId: play.workspaceId,
    organizationId: play.organizationId,
    playId: play.id,
    playTitle: play.title,
    entityType: entity.type,
    entityId: entity.id,
    entityName: entity.name,
    entityValue: entity.value,
    currentStepIndex: 0,
    totalSteps: play.steps.length,
    status: 'active',
    assignedTo: entity.assignedTo || '',
    assignedToName: entity.assignedToName || 'Unassigned',
    triggeredBy,
    triggerType,
    cascadeDepth,
    idempotencyKey,
    startedAt: now.toISOString(),
    lastStepExecutedAt: undefined,
    nextStepDueAt,
    stepHistory: [],
  };
}

/**
 * Advances a play execution instance upon completion, failure, or skip of a step.
 */
export function advancePlayExecution(
  instance: PlayExecutionInstance,
  play: SalesPlay,
  stepLog: PlayStepExecutionLog,
  now: Date
): PlayExecutionInstance {
  const currentStep = play.steps[instance.currentStepIndex];
  const updatedHistory = [...instance.stepHistory, stepLog];

  if (!currentStep) {
    return {
      ...instance,
      status: 'completed',
      completedAt: now.toISOString(),
      stepHistory: updatedHistory,
    };
  }

  // Handle failure logic
  if (stepLog.status === 'failed') {
    if (currentStep.onFailureAction === 'skip' && !currentStep.requiredForNextStep) {
      // Proceed to next step despite failure
    } else if (currentStep.onFailureAction === 'escalate') {
      // Keep active but mark escalated
      return {
        ...instance,
        status: 'active',
        lastStepExecutedAt: now.toISOString(),
        stepHistory: updatedHistory,
      };
    } else {
      // Halt execution
      return {
        ...instance,
        status: 'failed',
        completedAt: now.toISOString(),
        lastStepExecutedAt: now.toISOString(),
        stepHistory: updatedHistory,
      };
    }
  }

  // Check if there are more steps
  const nextIndex = instance.currentStepIndex + 1;
  if (nextIndex < play.steps.length) {
    const nextStep = play.steps[nextIndex];
    const delayMs = (nextStep.delayHours ?? 0) * 3600 * 1000;
    const nextStepDueAt = new Date(now.getTime() + delayMs).toISOString();

    return {
      ...instance,
      currentStepIndex: nextIndex,
      status: 'active',
      lastStepExecutedAt: now.toISOString(),
      nextStepDueAt,
      stepHistory: updatedHistory,
    };
  }

  // All steps completed
  return {
    ...instance,
    currentStepIndex: nextIndex,
    status: 'completed',
    completedAt: now.toISOString(),
    lastStepExecutedAt: now.toISOString(),
    nextStepDueAt: undefined,
    stepHistory: updatedHistory,
  };
}

/**
 * Evaluates workload capacity and assigns a lead or deal to the optimal rep.
 */
export function evaluateRoutingAssignment(
  entity: EntityEvaluationContext,
  rule: RoutingRule,
  reps: RepRoutingConfig[]
): RoutingEvaluationResult {
  if (!rule.enabled || reps.length === 0) {
    return {
      assignedRep: null,
      strategyUsed: rule.strategy,
      isFallback: true,
      reason: 'Rule disabled or roster empty; routed to fallback owner',
    };
  }

  // Filter reps who are available and have capacity
  const eligibleReps = reps.filter(
    (rep) => rep.isAvailable && rep.currentActiveCount < rep.maxActiveWorkload
  );

  if (eligibleReps.length === 0) {
    return {
      assignedRep: null,
      strategyUsed: rule.strategy,
      isFallback: true,
      reason: 'All representatives have reached maximum workload capacity; routed to manager overflow',
    };
  }

  if (rule.strategy === 'capacity_weighted') {
    // Score = (maxActiveWorkload - currentActiveCount) * weight
    let bestScore = -1;
    let selectedRep: RepRoutingConfig = eligibleReps[0];

    for (const rep of eligibleReps) {
      const remainingCapacity = Math.max(0, rep.maxActiveWorkload - rep.currentActiveCount);
      const repWeight = Math.max(1, rep.weight || 1);
      const score = remainingCapacity * repWeight;

      if (score > bestScore) {
        bestScore = score;
        selectedRep = rep;
      }
    }

    return {
      assignedRep: selectedRep,
      strategyUsed: 'capacity_weighted',
      isFallback: false,
      reason: `Assigned via capacity-weighted score (${bestScore})`,
    };
  }

  if (rule.strategy === 'tier_territory') {
    const dealValue = entity.value ?? 0;
    const tierCondition = rule.tierConditions;

    // Check if high value requires enterprise tier
    const isEnterprise =
      tierCondition?.minDealValue !== undefined && dealValue >= tierCondition.minDealValue;

    if (isEnterprise) {
      const enterpriseReps = eligibleReps.filter((r) => r.tier === 'enterprise');
      if (enterpriseReps.length > 0) {
        // Pick least loaded enterprise rep
        const sorted = [...enterpriseReps].sort(
          (a, b) => a.currentActiveCount - b.currentActiveCount
        );
        return {
          assignedRep: sorted[0],
          strategyUsed: 'tier_territory',
          isFallback: false,
          reason: `Assigned to Enterprise tier representative based on deal value ($${dealValue.toLocaleString()})`,
        };
      }
    }

    // Fallback within tier_territory to least loaded eligible rep
    const sorted = [...eligibleReps].sort(
      (a, b) => a.currentActiveCount - b.currentActiveCount
    );
    return {
      assignedRep: sorted[0],
      strategyUsed: 'tier_territory',
      isFallback: false,
      reason: 'Assigned to least loaded representative in pool',
    };
  }

  // Default: Round-Robin (least active count, then highest weight)
  const sorted = [...eligibleReps].sort((a, b) => {
    if (a.currentActiveCount !== b.currentActiveCount) {
      return a.currentActiveCount - b.currentActiveCount;
    }
    return (b.weight || 1) - (a.weight || 1);
  });

  return {
    assignedRep: sorted[0],
    strategyUsed: 'round_robin',
    isFallback: false,
    reason: `Assigned via round-robin distribution (${sorted[0].currentActiveCount} active deals)`,
  };
}

/**
 * Detects SLA breaches across leads and deals based on governance timers.
 */
export function detectSlaBreaches(
  entity: EntityEvaluationContext,
  rules: EscalationRule[],
  now: Date
): SlaBreachEvaluationResult[] {
  const breaches: SlaBreachEvaluationResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.triggerCondition === 'lead_untouched' && entity.type === 'lead') {
      if (entity.createdAt) {
        const createdTime = new Date(entity.createdAt).getTime();
        const elapsedMinutes = (now.getTime() - createdTime) / (1000 * 60);
        const thresholdMinutes = rule.thresholdHours * 60;

        if (elapsedMinutes >= thresholdMinutes && (!entity.lastActivityAt || entity.lastActivityAt === entity.createdAt)) {
          breaches.push({
            breached: true,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            triggerReason: `Lead has remained untouched for ${Math.round(elapsedMinutes)} minutes (SLA: ${thresholdMinutes}m)`,
          });
        }
      }
    }

    if (rule.triggerCondition === 'deal_stalled' && entity.type === 'deal') {
      const referenceTime = entity.lastActivityAt || entity.createdAt;
      if (referenceTime) {
        const elapsedDays = (now.getTime() - new Date(referenceTime).getTime()) / (1000 * 60 * 60 * 24);
        const thresholdDays = rule.thresholdHours / 24;

        if (elapsedDays >= thresholdDays) {
          breaches.push({
            breached: true,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            triggerReason: `Deal has had no buyer engagement for ${Math.round(elapsedDays)} days (SLA: ${thresholdDays}d)`,
          });
        }
      }
    }

    if (rule.triggerCondition === 'single_threaded_risk' && entity.type === 'deal') {
      const dealValue = entity.value ?? 0;
      const stakeholders = entity.stakeholderCount ?? 0;

      // Grace period check: allow rep time to input stakeholders if thresholdHours > 0
      let pastGracePeriod = true;
      if (rule.thresholdHours > 0 && entity.createdAt) {
        const elapsedHours =
          (now.getTime() - new Date(entity.createdAt).getTime()) / (1000 * 60 * 60);
        pastGracePeriod = elapsedHours >= rule.thresholdHours;
      }

      if (dealValue >= 10000 && stakeholders <= 1 && pastGracePeriod) {
        breaches.push({
          breached: true,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          triggerReason: `High-value deal ($${dealValue.toLocaleString()}) has only ${stakeholders} stakeholder identified`,
        });
      }
    }
  }

  return breaches;
}

/**
 * State machine transition for an ApprovalRequest.
 */
export function evaluateApprovalStatus(
  request: ApprovalRequest,
  action: 'approve' | 'reject' | 'escalate',
  actorId: string,
  actorName: string,
  actorRole: 'sales_manager' | 'vp_sales' | 'finance_admin',
  decisionNote: string,
  now: Date
): { updatedRequest: ApprovalRequest; error?: string } {
  // Guard: Reps or unauthorized roles cannot approve
  if (actorRole !== 'sales_manager' && actorRole !== 'vp_sales' && actorRole !== 'finance_admin') {
    return {
      updatedRequest: request,
      error: 'Unauthorized: Only Sales Managers, VP of Sales, or Finance Admins can approve requests.',
    };
  }

  // Guard: Request cannot be already resolved
  if (request.status !== 'pending' && request.status !== 'escalated') {
    return {
      updatedRequest: request,
      error: `Cannot modify request: Current status is '${request.status}'`,
    };
  }

  // Check expiration
  if (now.getTime() >= new Date(request.expiresAt).getTime()) {
    return {
      updatedRequest: {
        ...request,
        status: 'expired',
        decisionAt: now.toISOString(),
        decisionNote: 'Approval request expired automatically after SLA window',
      },
    };
  }

  if (action === 'approve') {
    return {
      updatedRequest: {
        ...request,
        status: 'approved',
        decisionAt: now.toISOString(),
        decisionBy: actorId,
        decisionByName: actorName,
        decisionNote: decisionNote || 'Approved',
      },
    };
  }

  if (action === 'reject') {
    return {
      updatedRequest: {
        ...request,
        status: 'rejected',
        decisionAt: now.toISOString(),
        decisionBy: actorId,
        decisionByName: actorName,
        decisionNote: decisionNote || 'Rejected',
      },
    };
  }

  if (action === 'escalate') {
    return {
      updatedRequest: {
        ...request,
        status: 'escalated',
        approverRole: 'vp_sales',
        decisionAt: now.toISOString(),
        decisionBy: actorId,
        decisionByName: actorName,
        decisionNote: decisionNote || 'Escalated to Executive Review',
      },
    };
  }

  return { updatedRequest: request };
}
