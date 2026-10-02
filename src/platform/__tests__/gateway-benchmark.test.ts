// @vitest-environment node
/**
 * @fileOverview Gateway Latency Overhead Benchmark (Phase 1 / PR-4)
 *
 * Implements Rule 9 (Load Resilience) and Rule 54 (Performance Budgets).
 * Verifies that the gateway traversal overhead for read operations is ≤ 50 ms (p95).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../capabilities/contracts/capability-definition';
import { executeCapability } from '../capabilities/execution/execute-capability';
import type { CapabilityInvocation } from '../capabilities/execution/invocation';

const benchmarkPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user-bench',
  organizationId: 'org-bench',
  workspaceId: 'ws-bench',
  grantedScopes: ['benchmark.read'],
  effectiveRole: 'admin',
};

const benchmarkCapability: AnyCapabilityDefinition = {
  id: 'benchmark.item.read',
  version: '1.0.0',
  name: 'Benchmark read',
  description: 'Fast in-memory benchmark read',
  domain: 'platform_integrations',
  operation: 'read',
  inputSchema: z.object({ itemId: z.string() }),
  outputSchema: z.object({ itemId: z.string(), value: z.number() }),
  permissions: ['benchmark.read'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 1000,
    supportsDryRun: false,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
  },
  handler: async (input: { itemId: string }) => ({
    success: true,
    data: { itemId: input.itemId, value: 42 },
    executionId: 'bench-exec',
    emittedEvents: [],
    durationMs: 0,
  }),
} as unknown as AnyCapabilityDefinition;

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

describe('Gateway Latency Overhead Benchmark (Rule 54)', () => {
  it('measures p95 pipeline overhead ≤ 50 ms for read operations across 100 iterations', async () => {
    const ITERATIONS = 100;
    const durations: number[] = [];

    // Warm-up iteration
    const warmUpInvocation: CapabilityInvocation = {
      capabilityId: 'benchmark.item.read',
      version: '1.0.0',
      surface: 'ui',
      input: { itemId: 'item-0' },
      principal: benchmarkPrincipal,
      correlationId: 'bench-warmup',
    };
    await executeCapability(warmUpInvocation, {
      registryLookup: () => benchmarkCapability,
    });

    // Benchmark loop
    for (let i = 0; i < ITERATIONS; i++) {
      const invocation: CapabilityInvocation = {
        capabilityId: 'benchmark.item.read',
        version: '1.0.0',
        surface: 'ui',
        input: { itemId: `item-${i}` },
        principal: benchmarkPrincipal,
        correlationId: `bench-${i}`,
      };

      const start = performance.now();
      const outcome = await executeCapability(invocation, {
        registryLookup: () => benchmarkCapability,
      });
      const elapsed = performance.now() - start;

      expect(outcome.success).toBe(true);
      durations.push(elapsed);
    }

    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    console.log(`[BENCHMARK] Read capability latency overhead: p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);

    // Budget: p95 must be ≤ 50 ms
    expect(p95).toBeLessThanOrEqual(50);
  });
});
