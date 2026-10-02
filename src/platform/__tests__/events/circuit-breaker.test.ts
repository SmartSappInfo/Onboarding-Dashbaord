// @vitest-environment node
/**
 * @fileOverview Unit & Invariant Tests for Circuit Breakers, Dead-Man Controls & Flags (Rules 24, 60, 64)
 *
 * Validates Rule 24 (Circuit Breakers), Rule 60 (Agent Dead-Man Controls),
 * and Rule 64 (Three-Level Feature Flags).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from '../../events/resilience/circuit-breaker';
import {
  checkEventDeadManSwitch,
  setEventDeadManStateForTests,
  EventBackboneEmergencyDisabledError,
} from '../../events/resilience/event-dead-man';
import {
  isEventBackboneEnabledForTenant,
  setEventFlagOverridesForTests,
} from '../../events/flags/event-flags';

describe('CircuitBreaker: Cascade Failure Defense (Rule 24)', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      coolOffPeriodMs: 50,
      halfOpenSuccessThreshold: 2,
    });
  });

  it('starts in CLOSED state and successfully executes healthy operations', async () => {
    expect(breaker.getState('webhook_crm')).toBe('CLOSED');

    const result = await breaker.execute('webhook_crm', async () => 'success_result');
    expect(result).toBe('success_result');
    expect(breaker.getState('webhook_crm')).toBe('CLOSED');
  });

  it('transitions to DEGRADED on single failure then OPEN upon reaching failure threshold', async () => {
    const failingOp = async () => {
      throw new Error('Connection refused');
    };

    // Attempt 1: failure -> DEGRADED
    await expect(breaker.execute('webhook_crm', failingOp)).rejects.toThrow('Connection refused');
    expect(breaker.getState('webhook_crm')).toBe('DEGRADED');

    // Attempt 2: failure -> DEGRADED
    await expect(breaker.execute('webhook_crm', failingOp)).rejects.toThrow('Connection refused');
    expect(breaker.getState('webhook_crm')).toBe('DEGRADED');

    // Attempt 3: failure -> trips OPEN
    await expect(breaker.execute('webhook_crm', failingOp)).rejects.toThrow('Connection refused');
    expect(breaker.getState('webhook_crm')).toBe('OPEN');

    // Subsequent call must fast-fail with CircuitBreakerOpenError without invoking the operation
    const mockFn = vi.fn();
    await expect(breaker.execute('webhook_crm', mockFn)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('transitions to HALF-OPEN after cool-off period and recovers to CLOSED after successive successes', async () => {
    const failingOp = async () => {
      throw new Error('Timeout');
    };

    // Trip the breaker (threshold = 3)
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute('webhook_deals', failingOp)).rejects.toThrow('Timeout');
    }
    expect(breaker.getState('webhook_deals')).toBe('OPEN');

    // Wait for cool-off (50ms)
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Next call probes in HALF-OPEN state
    const probe1 = await breaker.execute('webhook_deals', async () => 'recovered_1');
    expect(probe1).toBe('recovered_1');
    expect(breaker.getState('webhook_deals')).toBe('HALF-OPEN');

    // Second successive success recovers to CLOSED
    const probe2 = await breaker.execute('webhook_deals', async () => 'recovered_2');
    expect(probe2).toBe('recovered_2');
    expect(breaker.getState('webhook_deals')).toBe('CLOSED');
  });
});

describe('EventDeadMan: Emergency Halting Controls (Rule 60)', () => {
  beforeEach(() => {
    setEventDeadManStateForTests(false);
  });

  it('permits event processing when emergency switch is inactive', async () => {
    await expect(checkEventDeadManSwitch()).resolves.toBeUndefined();
  });

  it('instantly throws EventBackboneEmergencyDisabledError when emergency switch is active', async () => {
    setEventDeadManStateForTests(true);
    await expect(checkEventDeadManSwitch()).rejects.toBeInstanceOf(EventBackboneEmergencyDisabledError);
  });
});

describe('EventFlags: Three-Level Feature Flags (Rule 64)', () => {
  beforeEach(() => {
    setEventFlagOverridesForTests({});
  });

  it('defaults to true when no flags are configured', async () => {
    const enabled = await isEventBackboneEnabledForTenant('org_1', 'ws_1');
    expect(enabled).toBe(true);
  });

  it('workspace-level flag overrides organization and global levels', async () => {
    setEventFlagOverridesForTests({
      global: true,
      orgs: { org_1: true },
      workspaces: { ws_isolated: false },
    });

    const isWsDisabled = await isEventBackboneEnabledForTenant('org_1', 'ws_isolated');
    expect(isWsDisabled).toBe(false);

    const isOtherWsEnabled = await isEventBackboneEnabledForTenant('org_1', 'ws_healthy');
    expect(isOtherWsEnabled).toBe(true);
  });
});
