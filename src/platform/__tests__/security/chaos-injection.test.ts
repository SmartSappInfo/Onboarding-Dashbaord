/**
 * @fileOverview Unit & Integration Tests for Chaos Fault Injection Engine (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 2, 4, 18, 24, 25, 26, 27, 40, 45, 48, 60, 67, 68, 69, 1972.
 * Validates the 5 canonical chaos scenarios:
 * 1. HTTP_429_RATE_LIMIT -> Fallback cascade & backoff
 * 2. HTTP_500_PROVIDER_TIMEOUT -> Circuit breaker failover
 * 3. NETWORK_LATENCY_JITTER -> AbortSignal cooperative cancellation
 * 4. CONCURRENT_STATE_COLLISION -> Optimistic locking rejection (HTTP 409)
 * 5. PARTIAL_EXECUTION_FAILURE -> Reverse-LIFO Saga compensation & DLQ quarantine
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ChaosInjectionEngine,
  getChaosInjectionEngine,
} from '@/platform/resilience/chaos/chaos-injection-engine';
import {
  ChaosFaultRule,
  SecurityDomainError,
} from '@/platform/security/contracts/security-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 15 Milestone 3: ChaosInjectionEngine', () => {
  let engine: ChaosInjectionEngine;

  beforeEach(() => {
    engine = new ChaosInjectionEngine();
    engine.clearRules();
  });

  it('should register, list, and remove chaos fault rules', () => {
    const rule: ChaosFaultRule = {
      id: 'rule_429_test',
      targetCapabilityId: 'cost.route_model',
      targetPersonaId: 'billing_analyst',
      faultType: 'HTTP_429_RATE_LIMIT',
      probabilityPercent: 100,
      durationMs: 60000,
      active: true,
      createdAt: new Date().toISOString(),
    };

    engine.registerRule(rule);
    expect(engine.getActiveRules()).toHaveLength(1);
    expect(engine.getActiveRules()[0].id).toBe('rule_429_test');

    const removed = engine.removeRule('rule_429_test');
    expect(removed).toBe(true);
    expect(engine.getActiveRules()).toHaveLength(0);
  });

  it('Scenario 1: HTTP_429_RATE_LIMIT should trigger fallback cascade (Rule 24 & FM-3)', async () => {
    const outcome = await engine.simulateFaultScenario('HTTP_429_RATE_LIMIT', {
      organizationId: 'org_chaos_test',
      capabilityId: 'cost.route_model',
      personaId: 'billing_analyst',
    });

    expect(outcome.faultInjected).toBe(true);
    expect(outcome.faultType).toBe('HTTP_429_RATE_LIMIT');
    expect(outcome.recovered).toBe(true);
    expect(outcome.recoveryStrategy).toBe('MULTI_PROVIDER_FALLBACK_CASCADE');
    expect(outcome.quarantinedToDlq).toBe(false);
  });

  it('Scenario 2: HTTP_500_PROVIDER_TIMEOUT should trip provider failure and trigger failover', async () => {
    const outcome = await engine.simulateFaultScenario('HTTP_500_PROVIDER_TIMEOUT', {
      organizationId: 'org_chaos_test',
      capabilityId: 'ai.generate_completion',
      personaId: 'sdr_outbound',
    });

    expect(outcome.faultInjected).toBe(true);
    expect(outcome.faultType).toBe('HTTP_500_PROVIDER_TIMEOUT');
    expect(outcome.recovered).toBe(true);
    expect(outcome.recoveryStrategy).toBe('CIRCUIT_BREAKER_FAILOVER');
  });

  it('Scenario 3: NETWORK_LATENCY_JITTER should abort cooperatively via AbortSignal (Rule 26)', async () => {
    const controller = new AbortController();

    // Trigger abort after 50ms
    setTimeout(() => {
      controller.abort();
    }, 50);

    const outcome = await engine.simulateFaultScenario('NETWORK_LATENCY_JITTER', {
      organizationId: 'org_chaos_test',
      capabilityId: 'knowledge.hybrid_search',
      signal: controller.signal,
    });

    expect(outcome.faultInjected).toBe(true);
    expect(outcome.faultType).toBe('NETWORK_LATENCY_JITTER');
    expect(outcome.recovered).toBe(true);
    expect(outcome.recoveryStrategy).toBe('COOPERATIVE_ABORT_SIGNAL_CANCELLATION');
  });

  it('Scenario 4: CONCURRENT_STATE_COLLISION should reject stale version with HTTP 409 (Rule 18)', async () => {
    const outcome = await engine.simulateFaultScenario('CONCURRENT_STATE_COLLISION', {
      organizationId: 'org_chaos_test',
      capabilityId: 'finance.payment.reconcile',
      expectedVersion: 3,
      currentVersion: 4,
    });

    expect(outcome.faultInjected).toBe(true);
    expect(outcome.faultType).toBe('CONCURRENT_STATE_COLLISION');
    expect(outcome.recovered).toBe(false);
    expect(outcome.recoveryStrategy).toBe('OPTIMISTIC_LOCK_REJECT_409');
    expect(outcome.errorDetails).toContain('CONCURRENCY_VIOLATION');
  });

  it('Scenario 5: PARTIAL_EXECUTION_FAILURE should execute Reverse-LIFO Saga and route to DLQ (Rules 25 & 27)', async () => {
    const outcome = await engine.simulateFaultScenario('PARTIAL_EXECUTION_FAILURE', {
      organizationId: 'org_chaos_test',
      capabilityId: 'supervisor.mesh.handoff',
      stepIndex: 3,
      totalSteps: 5,
    });

    expect(outcome.faultInjected).toBe(true);
    expect(outcome.faultType).toBe('PARTIAL_EXECUTION_FAILURE');
    expect(outcome.recovered).toBe(true);
    expect(outcome.recoveryStrategy).toBe('REVERSE_LIFO_SAGA_COMPENSATION');
    expect(outcome.quarantinedToDlq).toBe(true);
  });

  it('should emit domain event when a chaos fault is injected (Rule 40)', async () => {
    const emitSpy = vi.spyOn(defaultEventBus, 'publish');

    await engine.simulateFaultScenario('HTTP_429_RATE_LIMIT', {
      organizationId: 'org_chaos_test',
      capabilityId: 'cost.route_model',
    });

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chaos.fault.injected',
      })
    );

    emitSpy.mockRestore();
  });

  it('should intercept live capability execution when an active rule matches', async () => {
    engine.registerRule({
      id: 'active_429_rule',
      targetCapabilityId: 'crm.deal.update',
      faultType: 'HTTP_429_RATE_LIMIT',
      probabilityPercent: 100,
      durationMs: 60000,
      active: true,
      createdAt: new Date().toISOString(),
    });

    await expect(
      engine.evaluateAndIntercept({
        organizationId: 'org_chaos_test',
        capabilityId: 'crm.deal.update',
      })
    ).rejects.toThrow(SecurityDomainError);
  });

  it('should preserve singleton instance across calls', () => {
    const e1 = getChaosInjectionEngine();
    const e2 = getChaosInjectionEngine();
    expect(e1).toBe(e2);
  });
});
