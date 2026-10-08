/**
 * @fileOverview Agent Health Monitoring Core & Dynamic Circuit Breaker Service
 *
 * Implements Step 6 (Learn: Continuous Health Telemetry & Dynamic Circuit Breakers)
 * of the 6-Step Responsible Execution Loop:
 *   PLAN → PREDICT (Snapshot Pre-State) → EXECUTE → VERIFY → COMMIT → LEARN
 *
 * Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md`:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism (Integer health scores 0-100, zero floating drift).
 * - Rule 12: Canonical Risk Vocabulary.
 * - Rule 16: Scoped Non-Wildcard RBAC.
 * - Rule 17: Non-Delegable Decider & Authority Restrictions (AI agents forbidden from resets).
 * - Rule 20: Telemetry Replay Protection via unique executionId deduplication.
 * - Rule 24: Dynamic Circuit Breakers (Auto-trip on failure rate or consecutive errors).
 * - Rule 40: Domain Event Publishing (`agent.health.*`).
 * - Rule 42: Dynamic Degradation to Shadow Mode (Zero live writes).
 * - Rule 48: Sanitized Error Taxonomy & HTTP Status Mapping.
 * - Rule 50: Tenant State & Cache Isolation.
 * - Rule 54: Circuit Breaker State Machine Invariants (CLOSED -> DEGRADED -> OPEN -> HALF_OPEN).
 * - Rule 55: Clamping Ceilings (Max 100 sliding window history entries).
 * - Rule 60: Emergency Dead-Man Switch Evaluation.
 * - Rule 61: Mandatory Justification for Operator Actions (>= 5 chars).
 * - Rule 69: Strangler Fig Invariant (HMR global singleton preservation).
 * - Rule 1962: Phase 14 Health Telemetry Gate.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  AgentHealthScorecard,
  AgentHealthScorecardSchema,
  RecordExecutionTelemetryInput,
  RecordExecutionTelemetryInputSchema,
  ResetCircuitBreakerInput,
  ResetCircuitBreakerInputSchema,
  AgentHealthError,
} from './health-types';
import { getPersonaHealthPolicy } from './agent-health-policy-matrix';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

// ============================================================================
// 1. CONSTANTS & RECORD INTERFACES
// ============================================================================

/** Maximum sliding window history entries per persona per Rule 55 */
const MAX_HISTORY_ENTRIES = 100;

interface TelemetryEntry {
  executionId: string;
  capabilityId: string;
  success: boolean;
  durationMs: number;
  tokenUsage: number;
  tokenCostUSD: number;
  toolError: boolean;
  errorCode?: string;
  recordedAt: number;
}

interface PersonaHealthState {
  scorecard: AgentHealthScorecard;
  history: TelemetryEntry[];
}

// ============================================================================
// 2. AGENT HEALTH SERVICE IMPLEMENTATION
// ============================================================================

export class AgentHealthService {
  /**
   * Multi-tenant in-memory store partitioned by `${organizationId}:${workspaceId}:${personaId}` (Rule 50).
   */
  private states: Map<string, PersonaHealthState> = new Map();

  /**
   * Resets in-memory telemetry state for test isolation.
   */
  public clearHistoryForTests(): void {
    this.states.clear();
  }

  /**
   * Records execution telemetry for an agent persona, recalculates health score,
   * updates the sliding-window buffer, and evaluates dynamic circuit breaker tripping.
   */
  public async recordTelemetry(
    input: RecordExecutionTelemetryInput,
    signal?: AbortSignal
  ): Promise<AgentHealthScorecard> {
    const parsed = RecordExecutionTelemetryInputSchema.parse(input);

    // Rule 60: Emergency dead-man switch evaluation
    try {
      await checkGovernanceDeadManSwitch(parsed.organizationId);
    } catch {
      throw new AgentHealthError(
        'HEALTH_DEAD_MAN_PAUSED',
        'Emergency dead-man switch is engaged across platform.'
      );
    }

    // Rule 26: Cooperative cancellation check
    if (signal?.aborted) {
      throw new AgentHealthError('HEALTH_TIMEOUT', 'Telemetry recording cancelled via AbortSignal');
    }

    const partitionKey = this.getPartitionKey(
      parsed.organizationId,
      parsed.workspaceId,
      parsed.personaId
    );

    let state = this.states.get(partitionKey);
    if (!state) {
      state = {
        scorecard: this.createDefaultScorecard(
          parsed.personaId,
          parsed.organizationId,
          parsed.workspaceId
        ),
        history: [],
      };
      this.states.set(partitionKey, state);
    }

    // Rule 20: Deduplication / Replay Defense by unique executionId
    const existingIndex = state.history.findIndex((e) => e.executionId === parsed.executionId);
    const newEntry: TelemetryEntry = {
      executionId: parsed.executionId,
      capabilityId: parsed.capabilityId,
      success: parsed.success,
      durationMs: parsed.durationMs,
      tokenUsage: parsed.tokenUsage ?? 0,
      tokenCostUSD: parsed.tokenCostUSD ?? 0,
      toolError: parsed.toolError ?? false,
      errorCode: parsed.errorCode,
      recordedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      state.history[existingIndex] = newEntry;
    } else {
      state.history.push(newEntry);
      // Rule 55: Clamping sliding-window buffer to max 100 entries
      if (state.history.length > MAX_HISTORY_ENTRIES) {
        state.history.splice(0, state.history.length - MAX_HISTORY_ENTRIES);
      }
    }

    // Recalculate scorecard from sliding window
    const policy = getPersonaHealthPolicy(parsed.personaId);
    const updatedScorecard = this.computeScorecard(
      parsed.personaId,
      parsed.organizationId,
      parsed.workspaceId,
      state.history,
      state.scorecard,
      policy
    );

    state.scorecard = updatedScorecard;

    // Rule 40: Domain event emissions
    await defaultEventBus.publish(
      createDomainEvent({
        type: 'agent.health.scorecard_updated',
        organizationId: parsed.organizationId,
        workspaceId: parsed.workspaceId,
        actor: { type: 'system', id: 'agent_health_service' },
        entity: { type: 'agent_persona', id: parsed.personaId },
        correlationId: parsed.executionId,
        source: 'agent.health.service',
        payload: {
          personaId: parsed.personaId,
          healthScore: updatedScorecard.healthScore,
          status: updatedScorecard.status,
          circuitState: updatedScorecard.circuitState,
          consecutiveFailures: updatedScorecard.consecutiveFailures,
          degradationMode: updatedScorecard.degradationMode,
        },
      })
    );

    return AgentHealthScorecardSchema.parse(updatedScorecard);
  }

  /**
   * Retrieves the current health scorecard for an agent persona.
   */
  public async getScorecard(params: {
    personaId: string;
    organizationId: string;
    workspaceId: string;
  }): Promise<AgentHealthScorecard> {
    const partitionKey = this.getPartitionKey(
      params.organizationId,
      params.workspaceId,
      params.personaId
    );

    const state = this.states.get(partitionKey);
    if (!state) {
      const defaultScorecard = this.createDefaultScorecard(
        params.personaId,
        params.organizationId,
        params.workspaceId
      );
      return AgentHealthScorecardSchema.parse(defaultScorecard);
    }

    return AgentHealthScorecardSchema.parse(state.scorecard);
  }

  /**
   * Lists all health scorecards for an organization workspace (Rule 8 Anti-IDOR).
   */
  public async listScorecards(params: {
    organizationId: string;
    workspaceId: string;
  }): Promise<AgentHealthScorecard[]> {
    const prefix = `${params.organizationId}:${params.workspaceId}:`;
    const results: AgentHealthScorecard[] = [];

    for (const [key, state] of this.states.entries()) {
      if (key.startsWith(prefix)) {
        results.push(AgentHealthScorecardSchema.parse(state.scorecard));
      }
    }

    return results;
  }

  /**
   * Manually resets a tripped circuit breaker (Rule 17 Non-Delegable Decider, Rule 61 Audit Justification).
   */
  public async resetCircuitBreaker(
    input: ResetCircuitBreakerInput & {
      actor: { type: string; id: string };
    }
  ): Promise<AgentHealthScorecard> {
    // Rule 17: Non-delegable restriction - only human operators may reset circuit breakers
    if (input.actor.type !== 'user') {
      throw new AgentHealthError(
        'HEALTH_UNAUTHORIZED_RESET',
        'Only authenticated human operators can reset circuit breakers (Rule 17).'
      );
    }

    // Rule 61: Audit justification must be >= 5 characters
    if (!input.justification || input.justification.trim().length < 5) {
      throw new AgentHealthError(
        'HEALTH_INVALID_JUSTIFICATION',
        'Audit justification must be at least 5 characters (Rule 61).'
      );
    }

    const parsed = ResetCircuitBreakerInputSchema.parse(input);

    const partitionKey = this.getPartitionKey(
      parsed.organizationId,
      parsed.workspaceId,
      parsed.personaId
    );

    let state = this.states.get(partitionKey);
    if (!state) {
      state = {
        scorecard: this.createDefaultScorecard(
          parsed.personaId,
          parsed.organizationId,
          parsed.workspaceId
        ),
        history: [],
      };
      this.states.set(partitionKey, state);
    }

    // Transition circuit state to HALF_OPEN (probing mode)
    const resetScorecard: AgentHealthScorecard = {
      ...state.scorecard,
      circuitState: 'HALF_OPEN',
      status: 'HEALTHY',
      consecutiveFailures: 0,
      degradationMode: 'NONE',
      trippedReason: null,
      updatedAt: new Date().toISOString(),
    };

    state.scorecard = resetScorecard;

    // Rule 40: Domain event emission
    await defaultEventBus.publish(
      createDomainEvent({
        type: 'agent.health.circuit_reset',
        organizationId: parsed.organizationId,
        workspaceId: parsed.workspaceId,
        actor: { type: 'user', id: input.actor.id },
        entity: { type: 'agent_persona', id: parsed.personaId },
        correlationId: `reset_${Date.now()}`,
        source: 'agent.health.service',
        payload: {
          personaId: parsed.personaId,
          justification: parsed.justification,
          resetBy: input.actor.id,
          circuitState: 'HALF_OPEN',
        },
      })
    );

    return AgentHealthScorecardSchema.parse(resetScorecard);
  }

  // ============================================================================
  // 3. PRIVATE MATHEMATICAL & STATE MACHINE HELPERS
  // ============================================================================

  private getPartitionKey(orgId: string, wsId: string, personaId: string): string {
    return `${orgId}:${wsId}:${personaId}`;
  }

  private createDefaultScorecard(
    personaId: string,
    organizationId: string,
    workspaceId: string
  ): AgentHealthScorecard {
    const now = new Date().toISOString();
    return {
      personaId,
      organizationId,
      workspaceId,
      healthScore: 100,
      status: 'HEALTHY',
      circuitState: 'CLOSED',
      successRate: 100,
      failureRate: 0,
      recoveryRate: 100,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      consecutiveFailures: 0,
      toolErrorsCount: 0,
      avgDurationMs: 0,
      tokenCostUSD: 0,
      updatedAt: now,
      lastTrippedAt: null,
      trippedReason: null,
      degradationMode: 'NONE',
    };
  }

  /**
   * Pure deterministic calculation of health scorecard and circuit state (Rules 11 & 24).
   */
  private computeScorecard(
    personaId: string,
    organizationId: string,
    workspaceId: string,
    history: TelemetryEntry[],
    previousScorecard: AgentHealthScorecard,
    policy: ReturnType<typeof getPersonaHealthPolicy>
  ): AgentHealthScorecard {
    const totalExecutions = history.length;
    if (totalExecutions === 0) {
      return this.createDefaultScorecard(personaId, organizationId, workspaceId);
    }

    const successfulExecutions = history.filter((e) => e.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const toolErrorsCount = history.filter((e) => e.toolError).length;

    const successRate = Math.round((successfulExecutions / totalExecutions) * 100);
    const failureRate = 100 - successRate;

    const totalDuration = history.reduce((sum, e) => sum + e.durationMs, 0);
    const avgDurationMs = Math.round(totalDuration / totalExecutions);

    const totalCost = history.reduce((sum, e) => sum + e.tokenCostUSD, 0);
    const tokenCostUSD = Math.round(totalCost * 1000) / 1000;

    // Consecutive failures from end of history backwards
    let consecutiveFailures = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].success) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Recovery Rate Calculation
    let failureTransitions = 0;
    let successfulRecoveries = 0;
    for (let i = 0; i < history.length - 1; i++) {
      if (!history[i].success) {
        failureTransitions++;
        if (history[i + 1].success) {
          successfulRecoveries++;
        }
      }
    }
    const recoveryRate =
      failureTransitions > 0
        ? Math.round((successfulRecoveries / failureTransitions) * 100)
        : 100;

    // Latency Score (S_latency: 100 if <= 5000ms, 0 if >= 30000ms)
    let latencyScore = 100;
    if (avgDurationMs > 5000) {
      const penalty = ((avgDurationMs - 5000) / 25000) * 100;
      latencyScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    }

    // Rule 11: Mathematical Health Score Formula
    const sSuccess = successRate;
    const sErrorRate = failureRate;
    const sRecovery = recoveryRate;
    const sLatency = latencyScore;

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(0.4 * sSuccess + 0.3 * (100 - sErrorRate) + 0.2 * sRecovery + 0.1 * sLatency)
      )
    );

    // Rule 24: Dynamic Circuit Breaker State Transition
    let circuitState = previousScorecard.circuitState;
    let status = previousScorecard.status;
    let degradationMode = previousScorecard.degradationMode;
    let lastTrippedAt = previousScorecard.lastTrippedAt;
    let trippedReason = previousScorecard.trippedReason;

    const isSlaBreached = failureRate > policy.maxFailureRate;
    const isConsecutiveLimitBreached = consecutiveFailures >= policy.maxConsecutiveFailures;

    if (isSlaBreached || isConsecutiveLimitBreached) {
      circuitState = 'OPEN';
      status = 'TRIPPED';
      degradationMode = policy.degradationMode;
      lastTrippedAt = new Date().toISOString();
      trippedReason = isConsecutiveLimitBreached
        ? `Exceeded consecutive failure limit (${consecutiveFailures} >= ${policy.maxConsecutiveFailures})`
        : `Breached failure SLA threshold (${failureRate}% > ${policy.maxFailureRate}%)`;

      // Emit circuit tripped domain event
      defaultEventBus.publish(
        createDomainEvent({
          type: 'agent.health.circuit_tripped',
          organizationId,
          workspaceId,
          actor: { type: 'system', id: 'agent_health_service' },
          entity: { type: 'agent_persona', id: personaId },
          correlationId: `trip_${Date.now()}`,
          source: 'agent.health.service',
          payload: {
            personaId,
            reason: trippedReason,
            failureRate,
            consecutiveFailures,
            degradationMode,
          },
        })
      );
    } else if (circuitState === 'OPEN') {
      // Check cool-off period
      if (lastTrippedAt) {
        const timeSinceTrip = Date.now() - Date.parse(lastTrippedAt);
        if (timeSinceTrip >= policy.coolOffPeriodMs) {
          circuitState = 'HALF_OPEN';
          status = 'DEGRADED';
          degradationMode = 'NONE';
        }
      }
    } else if (healthScore < 80 || failureRate > 5) {
      circuitState = 'DEGRADED';
      status = 'DEGRADED';
      degradationMode = 'NONE';
    } else {
      circuitState = 'CLOSED';
      status = 'HEALTHY';
      degradationMode = 'NONE';
      trippedReason = null;
    }

    return {
      personaId,
      organizationId,
      workspaceId,
      healthScore,
      status,
      circuitState,
      successRate,
      failureRate,
      recoveryRate,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      consecutiveFailures,
      toolErrorsCount,
      avgDurationMs,
      tokenCostUSD,
      updatedAt: new Date().toISOString(),
      lastTrippedAt,
      trippedReason,
      degradationMode,
    };
  }
}

// ============================================================================
// 4. GLOBAL SINGLETON ACCESSOR (Rule 69)
// ============================================================================

declare global {
  var __smartsappAgentHealthService: AgentHealthService | undefined;
}

export function getAgentHealthService(): AgentHealthService {
  if (!globalThis.__smartsappAgentHealthService) {
    globalThis.__smartsappAgentHealthService = new AgentHealthService();
  }
  return globalThis.__smartsappAgentHealthService;
}
