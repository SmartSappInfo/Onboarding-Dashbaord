/**
 * @fileOverview Agent State Machine Test Suite (Phase 6 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 21 (Human Approval Interception),
 * Rule 26 (True Cancellation Semantics), PRD §89 & Architecture Document 07.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidStateTransition,
  assertValidStateTransition,
  isTerminalState,
  isCancellableState,
  isPausedState,
  isActiveExecutionState,
  createStateHistoryEntry,
  TERMINAL_AGENT_RUN_STATES,
} from '../../runtime/agent-state-machine';
import { AgentRuntimeError, type AgentRunStatus } from '../../runtime/agent-run-types';

describe('Agent Finite State Machine', () => {
  describe('Terminal & State Properties', () => {
    it('identifies terminal states correctly', () => {
      expect(TERMINAL_AGENT_RUN_STATES).toEqual(['completed', 'failed', 'cancelled']);
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('failed')).toBe(true);
      expect(isTerminalState('cancelled')).toBe(true);

      expect(isTerminalState('created')).toBe(false);
      expect(isTerminalState('queued')).toBe(false);
      expect(isTerminalState('planning')).toBe(false);
      expect(isTerminalState('context_building')).toBe(false);
      expect(isTerminalState('executing')).toBe(false);
      expect(isTerminalState('waiting_for_approval')).toBe(false);
      expect(isTerminalState('verifying')).toBe(false);
      expect(isTerminalState('retrying')).toBe(false);
    });

    it('identifies cancellable states (Rule 26: any non-terminal state is cancellable)', () => {
      const nonTerminalStates: AgentRunStatus[] = [
        'created',
        'queued',
        'planning',
        'context_building',
        'executing',
        'waiting_for_approval',
        'verifying',
        'retrying',
      ];

      for (const st of nonTerminalStates) {
        expect(isCancellableState(st)).toBe(true);
      }

      for (const st of TERMINAL_AGENT_RUN_STATES) {
        expect(isCancellableState(st)).toBe(false);
      }
    });

    it('identifies paused state waiting for human approval (Rule 21)', () => {
      expect(isPausedState('waiting_for_approval')).toBe(true);
      expect(isPausedState('executing')).toBe(false);
      expect(isPausedState('planning')).toBe(false);
      expect(isPausedState('completed')).toBe(false);
    });

    it('identifies active execution states', () => {
      expect(isActiveExecutionState('executing')).toBe(true);
      expect(isActiveExecutionState('planning')).toBe(true);
      expect(isActiveExecutionState('context_building')).toBe(true);
      expect(isActiveExecutionState('verifying')).toBe(true);

      expect(isActiveExecutionState('queued')).toBe(false);
      expect(isActiveExecutionState('waiting_for_approval')).toBe(false);
      expect(isActiveExecutionState('completed')).toBe(false);
    });
  });

  describe('Valid State Transitions', () => {
    it('allows idempotent self-transitions', () => {
      const allStates: AgentRunStatus[] = [
        'created',
        'queued',
        'planning',
        'context_building',
        'executing',
        'waiting_for_approval',
        'verifying',
        'retrying',
        'completed',
        'failed',
        'cancelled',
      ];

      for (const st of allStates) {
        expect(isValidStateTransition(st, st)).toBe(true);
        expect(() => assertValidStateTransition(st, st)).not.toThrow();
      }
    });

    it('allows canonical forward progression: created -> queued -> planning -> context_building -> executing -> verifying -> completed', () => {
      expect(isValidStateTransition('created', 'queued')).toBe(true);
      expect(isValidStateTransition('queued', 'planning')).toBe(true);
      expect(isValidStateTransition('planning', 'context_building')).toBe(true);
      expect(isValidStateTransition('context_building', 'executing')).toBe(true);
      expect(isValidStateTransition('executing', 'verifying')).toBe(true);
      expect(isValidStateTransition('verifying', 'completed')).toBe(true);
    });

    it('allows human-in-the-loop pause and resumption (Rule 21)', () => {
      // Step encounters high-risk action -> pauses for approval
      expect(isValidStateTransition('executing', 'waiting_for_approval')).toBe(true);
      // Operator approves -> resumes execution
      expect(isValidStateTransition('waiting_for_approval', 'executing')).toBe(true);
      // Operator rejects -> triggers replanning
      expect(isValidStateTransition('waiting_for_approval', 'planning')).toBe(true);
    });

    it('allows failure retry and replanning progression', () => {
      expect(isValidStateTransition('executing', 'retrying')).toBe(true);
      expect(isValidStateTransition('verifying', 'retrying')).toBe(true);
      expect(isValidStateTransition('retrying', 'planning')).toBe(true);
      expect(isValidStateTransition('retrying', 'executing')).toBe(true);
    });

    it('allows cancellation from every active non-terminal state (Rule 26)', () => {
      const activeStates: AgentRunStatus[] = [
        'created',
        'queued',
        'planning',
        'context_building',
        'executing',
        'waiting_for_approval',
        'verifying',
        'retrying',
      ];

      for (const st of activeStates) {
        expect(isValidStateTransition(st, 'cancelled')).toBe(true);
        expect(() => assertValidStateTransition(st, 'cancelled', 'run_test_123')).not.toThrow();
      }
    });
  });

  describe('Illegal Transitions & Terminal Immutability', () => {
    it('strictly forbids transitions out of terminal states (TERMINAL_STATE_IMMUTABLE)', () => {
      for (const term of TERMINAL_AGENT_RUN_STATES) {
        expect(isValidStateTransition(term, 'executing')).toBe(false);
        expect(isValidStateTransition(term, 'planning')).toBe(false);
        expect(isValidStateTransition(term, 'created')).toBe(false);

        expect(() => assertValidStateTransition(term, 'executing', 'run_term_1')).toThrowError(
          AgentRuntimeError
        );

        try {
          assertValidStateTransition(term, 'executing', 'run_term_1');
        } catch (e) {
          const err = e as AgentRuntimeError;
          expect(err.code).toBe('TERMINAL_STATE_IMMUTABLE');
          expect(err.currentStatus).toBe(term);
          expect(err.targetStatus).toBe('executing');
        }
      }
    });

    it('rejects illegal jump transitions (INVALID_STATE_TRANSITION)', () => {
      // Cannot jump from created directly to completed
      expect(isValidStateTransition('created', 'completed')).toBe(false);
      expect(() => assertValidStateTransition('created', 'completed', 'run_jump')).toThrowError(
        AgentRuntimeError
      );

      // Cannot jump from planning directly to completed
      expect(isValidStateTransition('planning', 'completed')).toBe(false);
      expect(() => assertValidStateTransition('planning', 'completed', 'run_jump')).toThrowError(
        AgentRuntimeError
      );

      // Cannot jump from waiting_for_approval directly to completed
      expect(isValidStateTransition('waiting_for_approval', 'completed')).toBe(false);
      expect(() =>
        assertValidStateTransition('waiting_for_approval', 'completed', 'run_jump')
      ).toThrowError(AgentRuntimeError);

      try {
        assertValidStateTransition('created', 'completed', 'run_jump');
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('INVALID_STATE_TRANSITION');
        expect(err.currentStatus).toBe('created');
        expect(err.targetStatus).toBe('completed');
      }
    });
  });

  describe('State History Progression', () => {
    it('creates an immutable history entry with ISO timestamp and reason', () => {
      const entry = createStateHistoryEntry('created', 'queued', 'Enqueued by scheduler');
      expect(entry.from).toBe('created');
      expect(entry.to).toBe('queued');
      expect(entry.reason).toBe('Enqueued by scheduler');
      expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
    });
  });
});
