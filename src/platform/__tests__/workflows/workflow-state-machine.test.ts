/**
 * @fileOverview Unit tests for Workflow State Machine & Transition Matrix (Phase 7 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  VALID_WORKFLOW_TRANSITIONS,
  TERMINAL_WORKFLOW_STATES,
  isValidWorkflowTransition,
  assertValidWorkflowTransition,
  isTerminalWorkflowState,
  isCancellableWorkflowState,
  isWaitingWorkflowState,
  createCheckpointHash,
} from '../../workflows/workflow-state-machine';
import { WorkflowError } from '../../workflows/workflow-types';

describe('Workflow State Machine', () => {
  describe('Transition Matrix & Validation', () => {
    it('allows valid sequential workflow execution progression', () => {
      // CREATED -> QUEUED -> RUNNING -> WAITING -> RESUMED -> VERIFYING -> COMPLETED
      expect(isValidWorkflowTransition('CREATED', 'QUEUED')).toBe(true);
      expect(isValidWorkflowTransition('QUEUED', 'RUNNING')).toBe(true);
      expect(isValidWorkflowTransition('RUNNING', 'WAITING')).toBe(true);
      expect(isValidWorkflowTransition('WAITING', 'RESUMED')).toBe(true);
      expect(isValidWorkflowTransition('RESUMED', 'VERIFYING')).toBe(true);
      expect(isValidWorkflowTransition('VERIFYING', 'COMPLETED')).toBe(true);
    });

    it('allows direct progression from RUNNING to COMPLETED or VERIFYING', () => {
      expect(isValidWorkflowTransition('RUNNING', 'COMPLETED')).toBe(true);
      expect(isValidWorkflowTransition('RUNNING', 'VERIFYING')).toBe(true);
    });

    it('allows RESUMED to transition back to RUNNING', () => {
      expect(isValidWorkflowTransition('RESUMED', 'RUNNING')).toBe(true);
    });

    it('allows transitions to terminal failure/cancel/timeout states from active states', () => {
      const activeStates = ['CREATED', 'QUEUED', 'RUNNING', 'WAITING', 'RESUMED', 'VERIFYING'] as const;
      for (const state of activeStates) {
        expect(isValidWorkflowTransition(state, 'CANCELLED')).toBe(true);
        expect(isValidWorkflowTransition(state, 'TIMED_OUT')).toBe(true);
        expect(isValidWorkflowTransition(state, 'FAILED')).toBe(true);
      }
    });

    it('strictly forbids transitions out of terminal states (COMPLETED, FAILED, CANCELLED, TIMED_OUT)', () => {
      for (const terminal of TERMINAL_WORKFLOW_STATES) {
        expect(VALID_WORKFLOW_TRANSITIONS[terminal]).toEqual([]);
        expect(isValidWorkflowTransition(terminal, 'RUNNING')).toBe(false);
        expect(isValidWorkflowTransition(terminal, 'QUEUED')).toBe(false);
        expect(isValidWorkflowTransition(terminal, 'COMPLETED')).toBe(false);

        expect(() => assertValidWorkflowTransition(terminal, 'RUNNING')).toThrowError(WorkflowError);
        try {
          assertValidWorkflowTransition(terminal, 'RUNNING');
        } catch (err) {
          expect((err as WorkflowError).code).toBe('TERMINAL_STATE_IMMUTABLE');
        }
      }
    });

    it('throws INVALID_TRANSITION for illegal non-terminal transitions', () => {
      expect(isValidWorkflowTransition('CREATED', 'COMPLETED')).toBe(false);
      expect(isValidWorkflowTransition('CREATED', 'RESUMED')).toBe(false);
      expect(isValidWorkflowTransition('WAITING', 'COMPLETED')).toBe(false);

      expect(() => assertValidWorkflowTransition('CREATED', 'COMPLETED')).toThrowError(WorkflowError);
      try {
        assertValidWorkflowTransition('CREATED', 'COMPLETED');
      } catch (err) {
        expect((err as WorkflowError).code).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('State Predicates', () => {
    it('identifies terminal states correctly', () => {
      expect(isTerminalWorkflowState('COMPLETED')).toBe(true);
      expect(isTerminalWorkflowState('FAILED')).toBe(true);
      expect(isTerminalWorkflowState('CANCELLED')).toBe(true);
      expect(isTerminalWorkflowState('TIMED_OUT')).toBe(true);

      expect(isTerminalWorkflowState('CREATED')).toBe(false);
      expect(isTerminalWorkflowState('RUNNING')).toBe(false);
      expect(isTerminalWorkflowState('WAITING')).toBe(false);
    });

    it('identifies cancellable states (any non-terminal state)', () => {
      expect(isCancellableWorkflowState('CREATED')).toBe(true);
      expect(isCancellableWorkflowState('QUEUED')).toBe(true);
      expect(isCancellableWorkflowState('RUNNING')).toBe(true);
      expect(isCancellableWorkflowState('WAITING')).toBe(true);
      expect(isCancellableWorkflowState('RESUMED')).toBe(true);
      expect(isCancellableWorkflowState('VERIFYING')).toBe(true);

      expect(isCancellableWorkflowState('COMPLETED')).toBe(false);
      expect(isCancellableWorkflowState('FAILED')).toBe(false);
      expect(isCancellableWorkflowState('CANCELLED')).toBe(false);
      expect(isCancellableWorkflowState('TIMED_OUT')).toBe(false);
    });

    it('identifies waiting states', () => {
      expect(isWaitingWorkflowState('WAITING')).toBe(true);
      expect(isWaitingWorkflowState('RUNNING')).toBe(false);
      expect(isWaitingWorkflowState('RESUMED')).toBe(false);
    });
  });

  describe('Cryptographic Checkpoint Hash Generator (Rule 40)', () => {
    it('generates deterministic 64-character SHA-256 hash', () => {
      const payload1 = {
        workflowId: 'wf_123',
        sequence: 1,
        fromState: 'CREATED' as const,
        toState: 'QUEUED' as const,
        statePayload: { key: 'value', count: 42 },
      };

      const hash1 = createCheckpointHash(payload1);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);

      // Re-running with same payload yields identical hash
      const hash1Repeat = createCheckpointHash(payload1);
      expect(hash1Repeat).toBe(hash1);
    });

    it('changes hash when payload or previousHash changes (blockchain-like chaining)', () => {
      const basePayload = {
        workflowId: 'wf_123',
        sequence: 2,
        fromState: 'QUEUED' as const,
        toState: 'RUNNING' as const,
        statePayload: { foo: 'bar' },
        previousHash: 'a'.repeat(64),
      };

      const hashA = createCheckpointHash(basePayload);
      const hashB = createCheckpointHash({
        ...basePayload,
        previousHash: 'b'.repeat(64),
      });

      expect(hashA).not.toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
      expect(hashB).toMatch(/^[a-f0-9]{64}$/);
    });

    it('sorts keys canonically so key insertion order does not alter the hash', () => {
      const hash1 = createCheckpointHash({
        workflowId: 'wf_123',
        sequence: 1,
        fromState: 'CREATED' as const,
        toState: 'QUEUED' as const,
        statePayload: { a: 1, b: 2 },
      });

      const hash2 = createCheckpointHash({
        workflowId: 'wf_123',
        sequence: 1,
        fromState: 'CREATED' as const,
        toState: 'QUEUED' as const,
        statePayload: { b: 2, a: 1 },
      });

      expect(hash1).toBe(hash2);
    });
  });
});
