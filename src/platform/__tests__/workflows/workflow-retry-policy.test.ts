/**
 * @fileOverview Unit Tests for Workflow Retry Policy, Jitter & 5-State Circuit Breaker (Phase 7 Milestone 4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classifyWorkflowError,
  calculateRetryDelay,
  WorkflowCircuitBreakerManager,
} from '../../workflows/resilience/workflow-retry-policy';
import {
  DEFAULT_WORKFLOW_RETRY_POLICY,
  type WorkflowRetryPolicyConfig,
} from '../../workflows/resilience/workflow-resilience-types';

describe('Workflow Retry Policy & Circuit Breaker Engine (Phase 7 Milestone 4)', () => {
  describe('1. Error Classification Engine (Rule 48)', () => {
    it('correctly classifies transient downstream errors as retryable', () => {
      const err503 = { status: 503, message: 'Service Unavailable' };
      const res503 = classifyWorkflowError(err503);
      expect(res503.category).toBe('TRANSIENT');
      expect(res503.retryable).toBe(true);

      const err429 = { statusCode: 429, message: 'Too Many Requests' };
      const res429 = classifyWorkflowError(err429);
      expect(res429.category).toBe('TRANSIENT');
      expect(res429.retryable).toBe(true);
      expect(res429.suggestedBackoffMultiplier).toBe(2.5);

      const errTimeout = { code: 'ETIMEDOUT', message: 'Connection timed out' };
      const resTimeout = classifyWorkflowError(errTimeout);
      expect(resTimeout.category).toBe('TRANSIENT');
      expect(resTimeout.retryable).toBe(true);
    });

    it('correctly classifies fatal security and dead-man errors as non-retryable', () => {
      const errDeadMan = { code: 'DEAD_MAN_PAUSED', message: 'Halted by dead-man' };
      const resDeadMan = classifyWorkflowError(errDeadMan);
      expect(resDeadMan.category).toBe('FATAL');
      expect(resDeadMan.retryable).toBe(false);

      const errAuth = { status: 403, message: 'Forbidden: Insufficient privileges' };
      const resAuth = classifyWorkflowError(errAuth);
      expect(resAuth.category).toBe('FATAL');
      expect(resAuth.retryable).toBe(false);

      const errIdor = { code: 'IDOR_VIOLATION', message: 'Tenant boundary violation' };
      const resIdor = classifyWorkflowError(errIdor);
      expect(resIdor.category).toBe('FATAL');
      expect(resIdor.retryable).toBe(false);
    });

    it('correctly classifies functional schema and entity errors as permanent (route to DLQ)', () => {
      const errValidation = { code: 'INVALID_INPUT', message: 'Invalid field: email is required' };
      const resValidation = classifyWorkflowError(errValidation);
      expect(resValidation.category).toBe('PERMANENT');
      expect(resValidation.retryable).toBe(false);

      const errUnknown = new Error('Unknown internal business logic rejection');
      const resUnknown = classifyWorkflowError(errUnknown);
      expect(resUnknown.category).toBe('PERMANENT');
      expect(resUnknown.retryable).toBe(false);
    });
  });

  describe('2. Backoff Calculation with Full Jitter (Rule 23)', () => {
    it('calculates exponential delay with bounds and jitter', () => {
      const policy: WorkflowRetryPolicyConfig = {
        ...DEFAULT_WORKFLOW_RETRY_POLICY,
        baseBackoffMs: 1000,
        backoffMultiplier: 2.0,
        maxBackoffMs: 16000,
        jitter: 'full',
      };

      // Attempt 1: base = 1000ms -> full jitter in [500ms, 1500ms]
      const delay1 = calculateRetryDelay(policy, 1);
      expect(delay1.delayMs).toBeGreaterThanOrEqual(500);
      expect(delay1.delayMs).toBeLessThanOrEqual(1500);
      expect(delay1.delaySeconds).toBeGreaterThanOrEqual(1);

      // Attempt 3: base = 1000 * 2^2 = 4000ms -> jitter in [2000ms, 6000ms]
      const delay3 = calculateRetryDelay(policy, 3);
      expect(delay3.delayMs).toBeGreaterThanOrEqual(2000);
      expect(delay3.delayMs).toBeLessThanOrEqual(6000);

      // Attempt 6 (exceeding maxBackoffMs): capped at maxBackoffMs
      const delay6 = calculateRetryDelay(policy, 6);
      expect(delay6.delayMs).toBeLessThanOrEqual(policy.maxBackoffMs * 1.5);
    });

    it('supports deterministic none jitter mode', () => {
      const policy: WorkflowRetryPolicyConfig = {
        ...DEFAULT_WORKFLOW_RETRY_POLICY,
        baseBackoffMs: 1000,
        backoffMultiplier: 2.0,
        maxBackoffMs: 30000,
        jitter: 'none',
      };

      const delay1 = calculateRetryDelay(policy, 1);
      expect(delay1.delayMs).toBe(1000);
      expect(delay1.delaySeconds).toBe(1);

      const delay2 = calculateRetryDelay(policy, 2);
      expect(delay2.delayMs).toBe(2000);
      expect(delay2.delaySeconds).toBe(2);

      const delay4 = calculateRetryDelay(policy, 4);
      expect(delay4.delayMs).toBe(8000);
      expect(delay4.delaySeconds).toBe(8);
    });
  });

  describe('3. 5-State Capability Circuit Breaker (Rule 24)', () => {
    let cb: WorkflowCircuitBreakerManager;

    beforeEach(() => {
      cb = new WorkflowCircuitBreakerManager({
        failureThreshold: 3,
        cooldownMs: 2000,
        successThreshold: 2,
      });
    });

    it('initializes in healthy state and permits execution', () => {
      const check = cb.canExecute('crm.send_email');
      expect(check.allowed).toBe(true);
      expect(check.state).toBe('healthy');
    });

    it('transitions from healthy -> degraded -> open when consecutive failures hit threshold', () => {
      // Failure 1: degraded
      let state = cb.recordFailure('crm.send_email', '503 timeout');
      expect(state).toBe('degraded');
      expect(cb.canExecute('crm.send_email').allowed).toBe(true);

      // Failure 2: still degraded
      state = cb.recordFailure('crm.send_email', '503 timeout');
      expect(state).toBe('degraded');

      // Failure 3: threshold 3 reached -> trips to open!
      state = cb.recordFailure('crm.send_email', '503 timeout');
      expect(state).toBe('open');

      // Execution blocked fast
      const checkBlocked = cb.canExecute('crm.send_email');
      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.state).toBe('open');
      expect(checkBlocked.waitMsRemaining).toBeGreaterThan(0);
    });

    it('transitions to half_open after cooldown, tests recovery, and recovers to healthy', () => {
      // Trip to open
      cb.recordFailure('crm.send_email');
      cb.recordFailure('crm.send_email');
      cb.recordFailure('crm.send_email');
      expect(cb.canExecute('crm.send_email').allowed).toBe(false);

      // Fast forward time by 2100ms
      vi.useFakeTimers();
      vi.advanceTimersByTime(2100);

      // Check after cooldown -> transitions to half_open and allows probe request
      const checkProbe = cb.canExecute('crm.send_email');
      expect(checkProbe.allowed).toBe(true);
      expect(checkProbe.state).toBe('half_open');

      // First successful probe: remains half_open (requires successThreshold = 2)
      cb.recordSuccess('crm.send_email');
      const state1 = cb.getCircuitState('crm.send_email').state;
      expect(state1).toBe('half_open');

      // Second successful probe: recovers to healthy!
      cb.recordSuccess('crm.send_email');
      const state2 = cb.getCircuitState('crm.send_email').state;
      expect(state2).toBe('healthy');

      vi.useRealTimers();
    });

    it('probe failure in half_open trips immediately back to open', () => {
      // Trip to open
      cb.recordFailure('finance.charge_card');
      cb.recordFailure('finance.charge_card');
      cb.recordFailure('finance.charge_card');

      vi.useFakeTimers();
      vi.advanceTimersByTime(2500);

      // Probe check enters half_open
      expect(cb.canExecute('finance.charge_card').state).toBe('half_open');

      // Probe fails!
      const trippedState = cb.recordFailure('finance.charge_card', 'probe failed');
      expect(trippedState).toBe('open');
      expect(cb.canExecute('finance.charge_card').allowed).toBe(false);

      vi.useRealTimers();
    });
  });
});
