/**
 * @fileOverview Deterministic Agent Run Finite State Machine (Phase 6 Milestone 1)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 8: Multi-Tenancy & Integrity.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 21: Human-in-the-Loop Interception (`waiting_for_approval`).
 * - Rule 26: True Cancellation Semantics (`isCancellableState`).
 * - PRD §89 & Architecture Document 07: The 11 canonical lifecycle states.
 *
 * FINITE STATE MACHINE TRANSITION MATRIX:
 * ┌──────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Current State        │ Permitted Next States                                                  │
 * ├──────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ created              │ queued, planning, cancelled, failed                                    │
 * │ queued               │ planning, context_building, cancelled, failed                          │
 * │ planning             │ context_building, executing, retrying, cancelled, failed               │
 * │ context_building     │ planning, executing, retrying, cancelled, failed                       │
 * │ executing            │ waiting_for_approval, verifying, retrying, completed, failed, cancelled │
 * │ waiting_for_approval │ executing, planning, cancelled, failed                                 │
 * │ verifying            │ completed, retrying, planning, executing, failed, cancelled            │
 * │ retrying             │ planning, context_building, executing, failed, cancelled               │
 * │ completed (Terminal) │ [NONE - IMMUTABLE]                                                     │
 * │ failed (Terminal)    │ [NONE - IMMUTABLE]                                                     │
 * │ cancelled (Terminal) │ [NONE - IMMUTABLE]                                                     │
 * └──────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

import {
  type AgentRunStatus,
  type AgentRunStateHistoryEntry,
  AgentRuntimeError,
} from './agent-run-types';

/**
 * Terminal states that cannot transition to any subsequent state under any circumstance.
 */
export const TERMINAL_AGENT_RUN_STATES: readonly AgentRunStatus[] = [
  'completed',
  'failed',
  'cancelled',
] as const;

/**
 * Returns true if the status represents a final, immutable terminal state.
 */
export function isTerminalState(status: AgentRunStatus): boolean {
  return (TERMINAL_AGENT_RUN_STATES as readonly string[]).includes(status);
}

/**
 * Returns true if an agent run in this state can be cooperatively cancelled (Rule 26).
 * Any non-terminal state is cancellable.
 */
export function isCancellableState(status: AgentRunStatus): boolean {
  return !isTerminalState(status);
}

/**
 * Returns true if an agent run is paused waiting for operator intervention (Rule 21).
 */
export function isPausedState(status: AgentRunStatus): boolean {
  return status === 'waiting_for_approval';
}

/**
 * Returns true if the agent is actively executing tasks or reasoning.
 */
export function isActiveExecutionState(status: AgentRunStatus): boolean {
  return (
    status === 'executing' ||
    status === 'context_building' ||
    status === 'planning' ||
    status === 'verifying'
  );
}

/**
 * Deterministic transition map defining all allowable forward and recovery transitions.
 */
export const VALID_AGENT_RUN_TRANSITIONS: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  created: ['queued', 'planning', 'cancelled', 'failed'],
  queued: ['planning', 'context_building', 'cancelled', 'failed'],
  planning: ['context_building', 'executing', 'retrying', 'cancelled', 'failed'],
  context_building: ['planning', 'executing', 'retrying', 'cancelled', 'failed'],
  executing: [
    'waiting_for_approval',
    'verifying',
    'retrying',
    'completed',
    'failed',
    'cancelled',
  ],
  waiting_for_approval: ['executing', 'planning', 'cancelled', 'failed'],
  verifying: [
    'completed',
    'retrying',
    'planning',
    'executing',
    'failed',
    'cancelled',
  ],
  retrying: ['planning', 'context_building', 'executing', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Evaluates whether a state transition from `from` to `to` is legally permissible.
 *
 * Invariants:
 * 1. Self-transitions (`from === to`) are permitted as idempotent updates.
 * 2. Terminal states (`completed`, `failed`, `cancelled`) cannot transition to any other state.
 * 3. All non-terminal states can transition directly to `cancelled` (Rule 26).
 */
export function isValidStateTransition(from: AgentRunStatus, to: AgentRunStatus): boolean {
  // Idempotent self-transition is always valid
  if (from === to) {
    return true;
  }

  // Terminal states are strictly immutable
  if (isTerminalState(from)) {
    return false;
  }

  const allowedNext = VALID_AGENT_RUN_TRANSITIONS[from];
  return allowedNext.includes(to);
}

/**
 * Asserts that a state transition is legal, throwing a structured AgentRuntimeError if invalid.
 */
export function assertValidStateTransition(
  from: AgentRunStatus,
  to: AgentRunStatus,
  runId?: string
): void {
  if (from === to) {
    return;
  }

  if (isTerminalState(from)) {
    throw new AgentRuntimeError({
      code: 'TERMINAL_STATE_IMMUTABLE',
      message: `Cannot transition run from terminal state '${from}' to '${to}'. Terminal states are immutable.`,
      runId,
      currentStatus: from,
      targetStatus: to,
    });
  }

  if (!isValidStateTransition(from, to)) {
    const allowed = VALID_AGENT_RUN_TRANSITIONS[from].join(', ') || 'none';
    throw new AgentRuntimeError({
      code: 'INVALID_STATE_TRANSITION',
      message: `Illegal state transition from '${from}' to '${to}'. Allowed transitions: [${allowed}].`,
      runId,
      currentStatus: from,
      targetStatus: to,
    });
  }
}

/**
 * Builds an immutable state history progression entry.
 */
export function createStateHistoryEntry(
  from: AgentRunStatus,
  to: AgentRunStatus,
  reason?: string
): AgentRunStateHistoryEntry {
  return {
    from,
    to,
    timestamp: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
}
