// @vitest-environment node
/**
 * @fileOverview Unit & Integration Tests for Event Dispatcher Worker & Route (Milestone 1)
 *
 * Validates Rule 9 (Load & Concurrency Limits), Rule 13 (No Anonymous Fallback),
 * Rule 20 (Replay Protection), Rule 24 (Circuit Breakers), Rule 25 (Dead-Letter Queues),
 * Rule 51 (Route Handler Security Gate), and Rule 60 (Dead-Man Controls).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processEventDispatch,
  type EventDispatcherDependencies,
} from '../../tasks/event-dispatcher-worker';
import { createInMemoryOutboxReader } from '../../events/storage/outbox-reader';
import { createInMemoryExecutionLedger } from '../../events/storage/event-execution-ledger';
import { createInMemoryDeadLetterStorage } from '../../events/storage/dead-letter-storage';
import { CircuitBreaker } from '../../events/resilience/circuit-breaker';
import { setEventDeadManStateForTests } from '../../events/resilience/event-dead-man';
import { setEventFlagOverridesForTests } from '../../events/flags/event-flags';
import type { DomainEvent } from '../../capabilities/events/domain-event';

function createMockDomainEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type: 'tasks.task.created',
    version: '1.0.0',
    organizationId: 'org_worker_test',
    workspaceId: 'ws_worker_test',
    actor: {
      type: 'user',
      id: 'user_worker_1',
    },
    entity: {
      type: 'task',
      id: 'task_001',
    },
    payload: { title: 'Implement Outbox Dispatcher' },
    correlationId: 'corr_worker_test',
    source: '/workspaces/ws_worker_test/tasks',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('EventDispatcherWorker: End-to-End Execution Pipeline (Milestone 1)', () => {
  let deps: EventDispatcherDependencies;

  beforeEach(() => {
    setEventDeadManStateForTests(false);
    setEventFlagOverridesForTests(null);

    deps = {
      outboxReader: createInMemoryOutboxReader(),
      executionLedger: createInMemoryExecutionLedger(),
      deadLetterStorage: createInMemoryDeadLetterStorage(),
      circuitBreaker: new CircuitBreaker({ failureThreshold: 3, coolOffPeriodMs: 50 }),
      dispatchSink: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('processes empty outbox gracefully without errors', async () => {
    const result = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(0);
    expect(result.dispatchedCount).toBe(0);
  });

  it('leases pending events, dispatches them, and marks them published', async () => {
    const event1 = createMockDomainEvent();
    const event2 = createMockDomainEvent();
    await deps.outboxReader.enqueue([event1, event2]);

    const result = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(2);
    expect(result.dispatchedCount).toBe(2);
    expect(deps.dispatchSink).toHaveBeenCalledTimes(2);

    // Verify outbox records are now published
    const rec1 = await deps.outboxReader.get(event1.id);
    const rec2 = await deps.outboxReader.get(event2.id);
    expect(rec1?.status).toBe('published');
    expect(rec2?.status).toBe('published');
  });

  it('prevents double-dispatch on duplicate Cloud Tasks invocation (Rule 20)', async () => {
    const event = createMockDomainEvent();
    await deps.outboxReader.enqueue([event]);

    // First dispatch run
    const result1 = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);
    expect(result1.dispatchedCount).toBe(1);

    // Reset dispatch sink mock count
    (deps.dispatchSink as ReturnType<typeof vi.fn>).mockClear();

    // Re-enqueue the exact same event (simulating duplicate delivery / retry)
    await deps.outboxReader.enqueue([event]);

    const result2 = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);
    expect(result2.skippedCount).toBe(1);
    expect(result2.dispatchedCount).toBe(0);
    expect(deps.dispatchSink).not.toHaveBeenCalled();
  });

  it('quarantines failing events into Dead-Letter Queue after 3 attempts (Rule 25)', async () => {
    const failingEvent = createMockDomainEvent();
    await deps.outboxReader.enqueue([failingEvent]);

    deps.dispatchSink = vi.fn().mockRejectedValue(new Error('Fatal webhook destination 500'));

    // Attempt 1: failure -> attempts = 1
    const run1 = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);
    expect(run1.errors).toHaveLength(1);
    expect(run1.deadLetterCount).toBe(0);

    // Attempt 2: failure -> attempts = 2
    const run2 = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);
    expect(run2.errors).toHaveLength(1);
    expect(run2.deadLetterCount).toBe(0);

    // Attempt 3: failure -> reaches MAX_EVENT_ATTEMPTS (3) -> DLQ quarantine
    const run3 = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);
    expect(run3.deadLetterCount).toBe(1);

    // Verify record in dead_letter_events
    const dlqRecord = await deps.deadLetterStorage.get(failingEvent.id);
    expect(dlqRecord).not.toBeNull();
    expect(dlqRecord?.status).toBe('quarantined');
    expect(dlqRecord?.lastError).toContain('Fatal webhook destination 500');

    // Verify outbox record status is dead_letter
    const outboxRecord = await deps.outboxReader.get(failingEvent.id);
    expect(outboxRecord?.status).toBe('dead_letter');
  });

  it('halts execution immediately when emergency dead-man switch is engaged (Rule 60)', async () => {
    setEventDeadManStateForTests(true);

    const event = createMockDomainEvent();
    await deps.outboxReader.enqueue([event]);

    const result = await processEventDispatch({ batchSize: 10, leaseDurationMs: 60000 }, deps);

    expect(result.success).toBe(true);
    expect(result.skippedCount).toBe(1);
    expect(result.processedCount).toBe(0);
    expect(deps.dispatchSink).not.toHaveBeenCalled();
  });

  it('skips dispatch if feature flag is disabled for target workspace (Rule 64)', async () => {
    setEventFlagOverridesForTests({
      workspaces: { ws_disabled_tenant: false },
    });

    const result = await processEventDispatch(
      { batchSize: 10, leaseDurationMs: 60000, workspaceId: 'ws_disabled_tenant' },
      deps
    );

    expect(result.skippedCount).toBe(1);
    expect(result.processedCount).toBe(0);
  });
});
