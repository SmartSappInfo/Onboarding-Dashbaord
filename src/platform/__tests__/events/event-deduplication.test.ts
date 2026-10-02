// @vitest-environment node
/**
 * @fileOverview Unit & Invariant Tests for Event Execution Ledger & Replay Guard (Rule 20)
 *
 * Validates Rule 19 (Deterministic Idempotency Key Derivation), Rule 20 (Duplicate Delivery Defense),
 * Rule 47 (Multi-Tenant Isolation), and Rule 69 (Master Layering Axiom).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInMemoryExecutionLedger,
  createEventExecutionKey,
  type EventExecutionLedger,
} from '../../events/storage/event-execution-ledger';

describe('EventExecutionLedger: Replay Protection & Duplicate Delivery Guard (Rule 20)', () => {
  let ledger: EventExecutionLedger;

  beforeEach(() => {
    ledger = createInMemoryExecutionLedger();
  });

  it('generates deterministic SHA-256 idempotency key from organizationId and eventId', () => {
    const key1 = createEventExecutionKey('org_test_1', 'event_abc_123');
    const key2 = createEventExecutionKey('org_test_1', 'event_abc_123');
    const key3 = createEventExecutionKey('org_test_2', 'event_abc_123');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^[a-f0-9]{64}$/); // 64-char hex SHA-256
  });

  it('successfully acquires execution reservation on first delivery', async () => {
    const res = await ledger.reserveExecution({
      eventId: 'evt_first_delivery',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });

    expect(res.status).toBe('acquired');
    expect(res.idempotencyKey).toBeDefined();

    const record = await ledger.get(res.idempotencyKey);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('in_progress');
  });

  it('rejects concurrent delivery during active lease with active_lease (Rule 18)', async () => {
    const firstAttempt = await ledger.reserveExecution({
      eventId: 'evt_concurrent_test',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });
    expect(firstAttempt.status).toBe('acquired');

    const secondAttempt = await ledger.reserveExecution({
      eventId: 'evt_concurrent_test',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });
    expect(secondAttempt.status).toBe('active_lease');
  });

  it('returns already_completed when Cloud Tasks delivers duplicate after completion (Rule 20)', async () => {
    const initial = await ledger.reserveExecution({
      eventId: 'evt_duplicate_retry',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });
    expect(initial.status).toBe('acquired');

    await ledger.markExecutionCompleted(initial.idempotencyKey);

    const duplicateRetry = await ledger.reserveExecution({
      eventId: 'evt_duplicate_retry',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });

    expect(duplicateRetry.status).toBe('already_completed');
  });

  it('allows re-acquisition if active lease expires (crash recovery)', async () => {
    const initial = await ledger.reserveExecution({
      eventId: 'evt_crash_recovery',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 10, // 10ms short lease
    });
    expect(initial.status).toBe('acquired');

    await new Promise((resolve) => setTimeout(resolve, 25));

    const reacquired = await ledger.reserveExecution({
      eventId: 'evt_crash_recovery',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });

    expect(reacquired.status).toBe('acquired');
  });

  it('releases reservation on failure to permit subsequent retry attempts', async () => {
    const initial = await ledger.reserveExecution({
      eventId: 'evt_failure_retry',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });
    expect(initial.status).toBe('acquired');

    await ledger.releaseExecutionReservation(initial.idempotencyKey, 'Downstream subscriber error');

    const retried = await ledger.reserveExecution({
      eventId: 'evt_failure_retry',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      leaseDurationMs: 60000,
    });

    expect(retried.status).toBe('acquired');
  });
});
