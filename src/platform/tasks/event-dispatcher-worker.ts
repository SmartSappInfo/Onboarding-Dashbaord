/**
 * @fileOverview Asynchronous Cloud Tasks Event Dispatcher Worker (Milestone 1)
 *
 * Implements Rule 9 (High Load & Bounded Queues), Rule 13 (No Anonymous Fallback),
 * Rule 18 (Optimistic Concurrency & Leasing Locks), Rule 20 (Replay Protection),
 * Rule 24 (Circuit Breakers), Rule 25 (Dead-Letter Queues), Rule 47 (Multi-Tenant Isolation),
 * Rule 60 (Emergency Dead-Man Controls), and Rule 69 (Master Layering Axiom).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This worker runs asynchronously via Google Cloud Tasks invocation (/api/tasks/event-dispatcher).
 * - Events are leased with a bounded 60s lease to prevent concurrent double-processing across Cloud Run instances.
 * - Every event acquisition checks the atomic `event_executions` ledger. Duplicate task delivery
 *   is gracefully ignored with status 'already_completed' (Rule 20).
 * - Unrecoverable failures exceeding MAX_EVENT_ATTEMPTS (3) are quarantined to `dead_letter_events` (Rule 25).
 * - Sinks are protected by 5-state circuit breakers (Rule 24).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/event-dispatcher-worker.test.ts`.
 */

import type {
  EventDispatchOptions,
  EventDispatchResult,
} from '../events/contracts/event-dispatcher.contract';
import {
  type OutboxReader,
  defaultOutboxReader,
} from '../events/storage/outbox-reader';
import {
  type EventExecutionLedger,
  defaultExecutionLedger,
} from '../events/storage/event-execution-ledger';
import {
  type DeadLetterStorage,
  defaultDeadLetterStorage,
  MAX_EVENT_ATTEMPTS,
} from '../events/storage/dead-letter-storage';
import {
  type CircuitBreaker,
  defaultCircuitBreaker,
} from '../events/resilience/circuit-breaker';
import {
  checkEventDeadManSwitch,
  EventBackboneEmergencyDisabledError,
} from '../events/resilience/event-dead-man';
import { isEventBackboneEnabledForTenant } from '../events/flags/event-flags';
import type { DomainEvent } from '../capabilities/events/domain-event';

import { defaultEventBus, type EventBus } from '../events/event-bus';
import {
  defaultActivityAggregationService,
  type ActivityAggregationService,
} from '../events/activity/activity-aggregation-service';

export interface EventDispatcherDependencies {
  outboxReader: OutboxReader;
  executionLedger: EventExecutionLedger;
  deadLetterStorage: DeadLetterStorage;
  circuitBreaker: CircuitBreaker;
  dispatchSink?: (event: DomainEvent) => Promise<void>;
}

/**
 * Creates a production dispatch sink that publishes to the EventBus and materializes
 * denormalized activity timeline records (Milestone 2).
 */
export function createProductionEventBusSink(
  eventBus: EventBus = defaultEventBus,
  activityAggregator: ActivityAggregationService = defaultActivityAggregationService
): (event: DomainEvent) => Promise<void> {
  return async (event: DomainEvent): Promise<void> => {
    // 1. Materialize ActivityRecordV2 in append-only storage (Rules 11, 40)
    await activityAggregator.materializeAndStore(event);

    // 2. Publish to all registered multi-tenant subscribers (Rules 8, 24, 47)
    await eventBus.publish(event);
  };
}

export const defaultProductionDispatchSink = createProductionEventBusSink();

/**
 * Core asynchronous event dispatch processing cycle.
 */
export async function processEventDispatch(
  options: EventDispatchOptions,
  dependencies?: EventDispatcherDependencies
): Promise<EventDispatchResult> {
  const startTime = Date.now();
  const reader = dependencies?.outboxReader ?? defaultOutboxReader;
  const ledger = dependencies?.executionLedger ?? defaultExecutionLedger;
  const dlq = dependencies?.deadLetterStorage ?? defaultDeadLetterStorage;
  const breaker = dependencies?.circuitBreaker ?? defaultCircuitBreaker;
  const sink = dependencies?.dispatchSink ?? defaultProductionDispatchSink;

  // 1. Check Emergency Dead-Man Switch (Rule 60)
  try {
    await checkEventDeadManSwitch();
  } catch (err) {
    if (err instanceof EventBackboneEmergencyDisabledError) {
      return {
        success: true,
        processedCount: 0,
        dispatchedCount: 0,
        deadLetterCount: 0,
        skippedCount: 1,
        durationMs: Date.now() - startTime,
        errors: [],
      };
    }
    throw err;
  }

  // 2. Check Three-Level Feature Flags (Rule 64)
  if (options.organizationId || options.workspaceId) {
    const isEnabled = await isEventBackboneEnabledForTenant(
      options.organizationId,
      options.workspaceId
    );
    if (!isEnabled) {
      return {
        success: true,
        processedCount: 0,
        dispatchedCount: 0,
        deadLetterCount: 0,
        skippedCount: 1,
        durationMs: Date.now() - startTime,
        errors: [],
      };
    }
  }

  // 3. Acquire leased batch from outbox (Rules 9, 18)
  const leasedBatch = await reader.acquireLeasedBatch(options);
  if (leasedBatch.length === 0) {
    return {
      success: true,
      processedCount: 0,
      dispatchedCount: 0,
      deadLetterCount: 0,
      skippedCount: 0,
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  let dispatchedCount = 0;
  let deadLetterCount = 0;
  let skippedCount = 0;
  const errors: Array<{ eventId: string; error: string }> = [];

  // 4. Process each leased event with idempotency and circuit breaker guards
  for (const record of leasedBatch) {
    const reservation = await ledger.reserveExecution({
      eventId: record.id,
      organizationId: record.event.organizationId,
      workspaceId: record.event.workspaceId,
      leaseDurationMs: options.leaseDurationMs,
    });

    if (reservation.status === 'already_completed') {
      // Duplicate Cloud Tasks delivery: mark outbox published and skip side-effects (Rule 20)
      await reader.markPublished(record.id);
      skippedCount += 1;
      continue;
    }

    if (reservation.status === 'active_lease') {
      // Another worker instance is currently executing this event
      skippedCount += 1;
      continue;
    }

    // Reservation acquired: dispatch through circuit breaker
    const circuitKey = `sink:${record.event.type.split('.')[0] || 'default'}`;

    try {
      await breaker.execute(circuitKey, async () => {
        await sink(record.event);
      });

      // Dispatch succeeded: finalize outbox and ledger
      await reader.markPublished(record.id);
      await ledger.markExecutionCompleted(reservation.idempotencyKey);
      dispatchedCount += 1;
    } catch (dispatchErr: unknown) {
      const errorMessage =
        dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
      const errorStack = dispatchErr instanceof Error ? dispatchErr.stack : undefined;

      errors.push({ eventId: record.id, error: errorMessage });

      // Release execution reservation so retry is permitted
      await ledger.releaseExecutionReservation(reservation.idempotencyKey, errorMessage);

      const nextAttemptCount = record.attempts + 1;

      if (nextAttemptCount >= MAX_EVENT_ATTEMPTS) {
        // Quarantine to Dead-Letter Queue (Rule 25)
        await dlq.quarantineEvent({
          eventId: record.id,
          event: record.event,
          attempts: nextAttemptCount,
          lastError: errorMessage,
          errorStack,
          organizationId: record.event.organizationId,
          workspaceId: record.event.workspaceId,
        });

        await reader.markDeadLetter(record.id, errorMessage);
        deadLetterCount += 1;
      } else {
        // Release outbox lease for subsequent exponential backoff retry
        await reader.releaseLease(record.id, errorMessage);
      }
    }
  }

  return {
    success: errors.length === 0,
    processedCount: leasedBatch.length,
    dispatchedCount,
    deadLetterCount,
    skippedCount,
    durationMs: Date.now() - startTime,
    errors,
  };
}
