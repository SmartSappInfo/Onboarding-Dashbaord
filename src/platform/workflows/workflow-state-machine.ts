/**
 * @fileOverview Deterministic 10-State Workflow State Machine & Transition Matrix (Phase 7 Milestone 1)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. 10-STATE LIFECYCLE (Roadmap §PHASE 7):
 *    CREATED -> QUEUED -> RUNNING -> WAITING -> RESUMED -> VERIFYING -> COMPLETED
 *    With terminal failure/exit states: FAILED, CANCELLED, TIMED_OUT.
 * 2. TERMINAL IMMUTABILITY: Terminal states (COMPLETED, FAILED, CANCELLED, TIMED_OUT) can NEVER
 *    transition to any other state. Attempted transitions throw WorkflowError('TERMINAL_STATE_IMMUTABLE').
 * 3. COOPERATIVE CANCELLATION (Rule 26): Any active, non-terminal state can transition directly to CANCELLED.
 * 4. CRYPTOGRAPHIC PROVENANCE (Rule 40): Checkpoint hashing generates deterministic SHA-256 hashes
 *    from canonical sorted JSON representations, chaining back to the previous checkpoint hash.
 */

import { createHash } from 'node:crypto';
import {
  type WorkflowState,
  WorkflowError,
} from './workflow-types';

// ── 1. Transition Matrix Definition ─────────────────────────────────────────
export const VALID_WORKFLOW_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  CREATED: ['QUEUED', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  QUEUED: ['RUNNING', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  RUNNING: ['WAITING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  WAITING: ['RESUMED', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  RESUMED: ['RUNNING', 'VERIFYING', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  VERIFYING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
} as const;

export const TERMINAL_WORKFLOW_STATES: readonly WorkflowState[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
] as const;

// ── 2. Transition Predicates & Assertions ───────────────────────────────────
/**
 * Checks whether transitioning from `from` state to `to` state is valid according to the matrix.
 */
export function isValidWorkflowTransition(from: WorkflowState, to: WorkflowState): boolean {
  const allowed = VALID_WORKFLOW_TRANSITIONS[from];
  if (!allowed || allowed.length === 0) {
    return false;
  }
  return (allowed as readonly string[]).includes(to);
}

/**
 * Asserts that a state transition is valid, throwing a typed WorkflowError if illegal.
 * When `options.allowOperatorRecovery` is true, allows transitioning from FAILED to RUNNING, RESUMED, or QUEUED (Rule 25 & 63).
 */
export function assertValidWorkflowTransition(
  from: WorkflowState,
  to: WorkflowState,
  options?: { allowOperatorRecovery?: boolean }
): void {
  if (
    options?.allowOperatorRecovery &&
    from === 'FAILED' &&
    (to === 'RUNNING' || to === 'RESUMED' || to === 'QUEUED' || to === 'COMPLETED')
  ) {
    return;
  }

  if (isTerminalWorkflowState(from)) {
    throw new WorkflowError(
      'TERMINAL_STATE_IMMUTABLE',
      `Cannot transition workflow from terminal state '${from}' to '${to}'`
    );
  }

  if (!isValidWorkflowTransition(from, to)) {
    throw new WorkflowError(
      'INVALID_TRANSITION',
      `Invalid workflow transition from '${from}' to '${to}'. Allowed: [${VALID_WORKFLOW_TRANSITIONS[from].join(', ')}]`
    );
  }
}

/**
 * Returns true if the state is one of the 4 terminal states.
 */
export function isTerminalWorkflowState(state: WorkflowState): boolean {
  return (TERMINAL_WORKFLOW_STATES as readonly string[]).includes(state);
}

/**
 * Returns true if the workflow can be cooperatively cancelled (i.e. any non-terminal state).
 */
export function isCancellableWorkflowState(state: WorkflowState): boolean {
  return !isTerminalWorkflowState(state);
}

/**
 * Returns true if the workflow is currently suspended waiting for external signals.
 */
export function isWaitingWorkflowState(state: WorkflowState): boolean {
  return state === 'WAITING';
}

// ── 3. Canonical JSON Stringifier & Checkpoint Hashing ─────────────────────
/**
 * Deterministically sorts object keys deeply to produce identical JSON representations regardless of insertion order.
 */
function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`
  );
  return `{${entries.join(',')}}`;
}

export interface CheckpointHashPayload {
  workflowId: string;
  sequence: number;
  fromState: WorkflowState;
  toState: WorkflowState;
  stepId?: string;
  statePayload: Record<string, unknown>;
  previousHash?: string;
}

/**
 * Computes a deterministic SHA-256 integrity hash for a workflow checkpoint (Rule 40).
 */
export function createCheckpointHash(payload: CheckpointHashPayload): string {
  const canonicalData = {
    workflowId: payload.workflowId,
    sequence: payload.sequence,
    fromState: payload.fromState,
    toState: payload.toState,
    stepId: payload.stepId ?? null,
    statePayload: payload.statePayload,
    previousHash: payload.previousHash ?? null,
  };

  const serialized = canonicalJsonStringify(canonicalData);
  return createHash('sha256').update(serialized).digest('hex');
}
