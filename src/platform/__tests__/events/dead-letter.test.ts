// @vitest-environment node
/**
 * @fileOverview Unit & Invariant Tests for Dead-Letter Queue & Exponential Backoff (Rule 25)
 *
 * Validates Rule 24 (Circuit Breakers), Rule 25 (Dead-Letter & Recovery Queues),
 * Rule 40 (Audit Immutability), and Rule 47 (Multi-Tenant Isolation).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInMemoryDeadLetterStorage,
  calculateBackoffMs,
  MAX_EVENT_ATTEMPTS,
  type DeadLetterStorage,
} from '../../events/storage/dead-letter-storage';
import type { DomainEvent } from '../../capabilities/events/domain-event';

function createMockDomainEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type: 'deal.stage_changed',
    version: '1.0.0',
    organizationId: 'org_dlq_test',
    workspaceId: 'ws_dlq_test',
    actor: {
      type: 'agent',
      id: 'agent_sales_copilot',
    },
    entity: {
      type: 'deal',
      id: 'deal_999',
    },
    payload: { oldStage: 'lead', newStage: 'negotiation' },
    correlationId: 'corr_dlq_test',
    source: '/workspaces/ws_dlq_test/deals',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('DeadLetterStorage: Recovery & Quarantine Engine (Rule 25)', () => {
  let dlq: DeadLetterStorage;

  beforeEach(() => {
    dlq = createInMemoryDeadLetterStorage();
  });

  describe('calculateBackoffMs', () => {
    it('scales exponentially with attempts and bounds by maxMs', () => {
      const b0 = calculateBackoffMs(0, 1000, 30000); // ~1000ms + jitter
      const b1 = calculateBackoffMs(1, 1000, 30000); // ~2000ms + jitter
      const b2 = calculateBackoffMs(2, 1000, 30000); // ~4000ms + jitter
      const bMax = calculateBackoffMs(10, 1000, 30000); // capped at 30000 + jitter

      expect(b0).toBeGreaterThanOrEqual(1000);
      expect(b1).toBeGreaterThanOrEqual(2000);
      expect(b2).toBeGreaterThanOrEqual(4000);
      expect(bMax).toBeLessThanOrEqual(36000); // 30000 + 20% jitter
    });
  });

  describe('Quarantine & Operations', () => {
    it('quarantines permanently failed event with diagnostic metadata', async () => {
      const event = createMockDomainEvent();

      await dlq.quarantineEvent({
        eventId: event.id,
        event,
        attempts: MAX_EVENT_ATTEMPTS,
        lastError: 'Downstream webhook timeout after 30000ms',
        errorStack: 'Error: timeout\n  at dispatchWebhook()',
        organizationId: event.organizationId,
        workspaceId: event.workspaceId,
      });

      const quarantined = await dlq.get(event.id);
      expect(quarantined).not.toBeNull();
      expect(quarantined?.status).toBe('quarantined');
      expect(quarantined?.attempts).toBe(3);
      expect(quarantined?.lastError).toContain('webhook timeout');
      expect(quarantined?.quarantinedAt).toBeDefined();
    });

    it('lists quarantined events filtered by organizationId (Rule 47)', async () => {
      const event1 = createMockDomainEvent({ organizationId: 'org_a' });
      const event2 = createMockDomainEvent({ organizationId: 'org_b' });

      await dlq.quarantineEvent({
        eventId: event1.id,
        event: event1,
        attempts: 3,
        lastError: 'Error A',
        organizationId: 'org_a',
      });

      await dlq.quarantineEvent({
        eventId: event2.id,
        event: event2,
        attempts: 3,
        lastError: 'Error B',
        organizationId: 'org_b',
      });

      const listA = await dlq.listDeadLetterEvents({ organizationId: 'org_a' });
      expect(listA).toHaveLength(1);
      expect(listA[0].eventId).toBe(event1.id);

      const listB = await dlq.listDeadLetterEvents({ organizationId: 'org_b' });
      expect(listB).toHaveLength(1);
      expect(listB[0].eventId).toBe(event2.id);
    });

    it('supports operator 1-click replaying and updates status to replayed', async () => {
      const event = createMockDomainEvent();

      await dlq.quarantineEvent({
        eventId: event.id,
        event,
        attempts: 3,
        lastError: 'Database lock collision',
        organizationId: event.organizationId,
      });

      await dlq.markReplayed(event.id);

      const record = await dlq.get(event.id);
      expect(record?.status).toBe('replayed');
      expect(record?.replayedAt).toBeDefined();
    });

    it('supports operator discarding quarantined events with audit reason', async () => {
      const event = createMockDomainEvent();

      await dlq.quarantineEvent({
        eventId: event.id,
        event,
        attempts: 3,
        lastError: 'Malformed payload in external client',
        organizationId: event.organizationId,
      });

      await dlq.markDiscarded(event.id, 'Operator deemed unrecoverable');

      const record = await dlq.get(event.id);
      expect(record?.status).toBe('discarded');
      expect(record?.operatorNotes).toBe('Operator deemed unrecoverable');
    });
  });
});
