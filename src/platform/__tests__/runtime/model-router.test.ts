/**
 * @fileOverview Unit & Integration Tests for Tiered Model Router & Circuit Breakers (Rule 58 & Rule 24)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import {
  TieredModelRouter,
  DeterministicMockModelProvider,
} from '@/platform/runtime/routing/model-router';
import {
  type CircuitBreakerConfig,
} from '@/platform/runtime/routing/model-router-types';
import { AgentRuntimeError } from '@/platform/runtime/agent-run-types';

describe('TieredModelRouter (Rule 58 & Rule 24)', () => {
  let mockFlash: DeterministicMockModelProvider;
  let mockPro: DeterministicMockModelProvider;
  let router: TieredModelRouter;

  const testConfig: CircuitBreakerConfig = {
    failureThreshold: 2,
    recoveryThreshold: 2,
    resetTimeoutMs: 100, // Short 100ms for fast testing
    degradedThreshold: 1,
  };

  beforeEach(() => {
    mockFlash = new DeterministicMockModelProvider('mock-flash', 'flash');
    mockPro = new DeterministicMockModelProvider('mock-pro', 'pro');
    router = new TieredModelRouter({
      providers: {
        flash: mockFlash,
        pro: mockPro,
      },
      circuitBreakerConfig: testConfig,
    });
  });

  describe('Task-Based Routing Policy (Rule 58)', () => {
    it('routes low-latency tasks (classification, triage) to Flash tier', async () => {
      mockFlash.enqueueResponse('Intent: crm_search');

      const result = await router.generateText('Classify: find John', {
        taskCategory: 'classification',
      });

      expect(result.data).toBe('Intent: crm_search');
      expect(result.telemetry.tier).toBe('flash');
      expect(result.telemetry.isDegradedFallback).toBe(false);
      expect(mockFlash.callCount).toBe(1);
      expect(mockPro.callCount).toBe(0);
    });

    it('routes complex reasoning tasks (dag_planning, replanning) to Pro tier', async () => {
      mockPro.enqueueResponse('Plan: Step 1 -> Step 2');

      const result = await router.generateText('Decompose goal: Prepare meeting', {
        taskCategory: 'dag_planning',
      });

      expect(result.data).toBe('Plan: Step 1 -> Step 2');
      expect(result.telemetry.tier).toBe('pro');
      expect(result.telemetry.isDegradedFallback).toBe(false);
      expect(mockPro.callCount).toBe(1);
      expect(mockFlash.callCount).toBe(0);
    });

    it('honors preferredTier override regardless of task category', async () => {
      mockPro.enqueueResponse('Pro classification');

      const result = await router.generateText('Classify with highest precision', {
        taskCategory: 'classification',
        preferredTier: 'pro',
      });

      expect(result.telemetry.tier).toBe('pro');
      expect(mockPro.callCount).toBe(1);
      expect(mockFlash.callCount).toBe(0);
    });
  });

  describe('5-State Circuit Breaker State Machine (Rule 24)', () => {
    it('transitions from healthy -> degraded -> open on consecutive errors', async () => {
      expect(router.getCircuitBreakerStatus('pro').state).toBe('healthy');

      // Failure 1 -> Degraded
      mockPro.enqueueError(new Error('503 Service Unavailable'));
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();

      expect(router.getCircuitBreakerStatus('pro').state).toBe('degraded');

      // Failure 2 -> Open (trips at failureThreshold = 2)
      mockPro.enqueueError(new Error('429 Rate Limit Exceeded'));
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();

      expect(router.getCircuitBreakerStatus('pro').state).toBe('open');
    });

    it('automatically falls back from Pro to Flash when Pro circuit is OPEN', async () => {
      // Trip Pro circuit to OPEN
      mockPro.enqueueError(new Error('503 Outage'));
      mockPro.enqueueError(new Error('503 Outage'));

      // Two failing calls with fallback disabled to trip the circuit
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();

      expect(router.getCircuitBreakerStatus('pro').state).toBe('open');

      // Now call with fallback enabled (default true)
      mockFlash.enqueueResponse('Fallback Flash Plan');
      const result = await router.generateText('Plan DAG', {
        taskCategory: 'dag_planning',
      });

      expect(result.data).toBe('Fallback Flash Plan');
      expect(result.telemetry.tier).toBe('flash');
      expect(result.telemetry.isDegradedFallback).toBe(true);
    });

    it('transitions from open -> half_open after cooldown, then recovered on successes', async () => {
      // Trip Pro circuit
      mockPro.enqueueError(new Error('503 Outage'));
      mockPro.enqueueError(new Error('503 Outage'));
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();
      await expect(
        router.generateText('Plan', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();

      expect(router.getCircuitBreakerStatus('pro').state).toBe('open');

      // Wait for reset timeout (100ms)
      await new Promise((resolve) => setTimeout(resolve, 120));

      // First call after cooldown should probe (half_open)
      mockPro.enqueueResponse('Probe Success 1');
      const probe1 = await router.generateText('Probe 1', {
        preferredTier: 'pro',
        enableFallback: false,
      });
      expect(probe1.data).toBe('Probe Success 1');
      expect(router.getCircuitBreakerStatus('pro').state).toBe('half_open');

      // Second success meets recoveryThreshold (2) -> recovered / healthy
      mockPro.enqueueResponse('Probe Success 2');
      const probe2 = await router.generateText('Probe 2', {
        preferredTier: 'pro',
        enableFallback: false,
      });
      expect(probe2.data).toBe('Probe Success 2');
      expect(router.getCircuitBreakerStatus('pro').state).toBe('healthy');
    });

    it('fails closed with CIRCUIT_BREAKER_OPEN if both Pro and Flash are OPEN', async () => {
      // Trip Pro circuit
      mockPro.enqueueError(new Error('503 Pro'));
      mockPro.enqueueError(new Error('503 Pro'));
      await expect(
        router.generateText('1', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();
      await expect(
        router.generateText('2', { preferredTier: 'pro', enableFallback: false })
      ).rejects.toThrow();

      // Trip Flash circuit
      mockFlash.enqueueError(new Error('503 Flash'));
      mockFlash.enqueueError(new Error('503 Flash'));
      await expect(
        router.generateText('3', { preferredTier: 'flash', enableFallback: false })
      ).rejects.toThrow();
      await expect(
        router.generateText('4', { preferredTier: 'flash', enableFallback: false })
      ).rejects.toThrow();

      expect(router.getCircuitBreakerStatus('pro').state).toBe('open');
      expect(router.getCircuitBreakerStatus('flash').state).toBe('open');

      // Requesting generation should now throw AgentRuntimeError CIRCUIT_BREAKER_OPEN
      await expect(
        router.generateText('Goal', { taskCategory: 'dag_planning' })
      ).rejects.toThrowError(AgentRuntimeError);

      try {
        await router.generateText('Goal', { taskCategory: 'dag_planning' });
      } catch (e) {
        const err = e as AgentRuntimeError;
        expect(err.code).toBe('CIRCUIT_BREAKER_OPEN');
      }
    });
  });

  describe('Structured Output Generation (Rule 47)', () => {
    const TestSchema = z.object({
      stepTitle: z.string(),
      estimatedTokens: z.number(),
    });

    it('validates structured outputs against Zod schemas', async () => {
      mockPro.enqueueResponse(JSON.stringify({ stepTitle: 'Fetch CRM Note', estimatedTokens: 450 }));

      const result = await router.generateStructured(
        'Generate step',
        TestSchema,
        { taskCategory: 'dag_planning' }
      );

      expect(result.data.stepTitle).toBe('Fetch CRM Note');
      expect(result.data.estimatedTokens).toBe(450);
      expect(result.telemetry.tier).toBe('pro');
    });

    it('throws AgentRuntimeError on schema validation failure', async () => {
      mockPro.enqueueResponse(JSON.stringify({ wrongField: 'invalid' }));

      await expect(
        router.generateStructured('Generate step', TestSchema, { taskCategory: 'dag_planning' })
      ).rejects.toThrowError(AgentRuntimeError);
    });
  });
});
