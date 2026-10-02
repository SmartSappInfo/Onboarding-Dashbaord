// @vitest-environment node
/**
 * @fileOverview Unit & Concurrency Tests for Outbox Storage Reader (Milestone 1)
 *
 * Validates Rule 9 (Bounded Load), Rule 18 (Optimistic Concurrency & Leasing Locks),
 * Rule 47 (Multi-Tenant Isolation), and Rule 69 (Master Layering Axiom).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInMemoryOutboxReader,
  type OutboxReader,
} from '../../events/storage/outbox-reader';
import type { DomainEvent } from '../../capabilities/events/domain-event';

function createMockDomainEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type: 'crm.contact.created',
    version: '1.0.0',
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
    actor: {
      type: 'user',
      id: 'user_test_1',
    },
    entity: {
      type: 'contact',
      id: 'contact_123',
    },
    payload: { name: 'Acme Academy' },
    correlationId: 'corr_test_123',
    source: '/workspaces/ws_test_1/contacts',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('OutboxReader: Concurrency & Leasing Engine (Rule 18)', () => {
  let reader: OutboxReader;

  beforeEach(() => {
    reader = createInMemoryOutboxReader();
  });

  it('acquires leased batch for pending outbox records and marks them processing', async () => {
    const event1 = createMockDomainEvent();
    const event2 = createMockDomainEvent();

    await reader.enqueue([event1, event2]);

    const batch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });

    expect(batch).toHaveLength(2);
    expect(batch[0].status).toBe('processing');
    expect(batch[1].status).toBe('processing');
    expect(batch[0].leaseExpiresAt).toBeDefined();

    // Verify subsequent call does not re-acquire records with active lease
    const secondBatch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(secondBatch).toHaveLength(0);
  });

  it('respects batchSize limits during lease acquisition (Rule 9)', async () => {
    const events = Array.from({ length: 5 }, () => createMockDomainEvent());
    await reader.enqueue(events);

    const batch = await reader.acquireLeasedBatch({
      batchSize: 2,
      leaseDurationMs: 60000,
    });

    expect(batch).toHaveLength(2);

    const remaining = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });

    expect(remaining).toHaveLength(3);
  });

  it('automatically reclaims expired leases when worker crashes or times out', async () => {
    const event = createMockDomainEvent();
    await reader.enqueue([event]);

    // Acquire with very short lease (10ms)
    const initialBatch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 10,
    });
    expect(initialBatch).toHaveLength(1);

    // Wait 25ms so lease expires
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Next acquisition must reclaim the expired lease
    const reclaimedBatch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(reclaimedBatch).toHaveLength(1);
    expect(reclaimedBatch[0].id).toBe(event.id);
    expect(reclaimedBatch[0].status).toBe('processing');
  });

  it('releases lease on temporary failure and allows retry', async () => {
    const event = createMockDomainEvent();
    await reader.enqueue([event]);

    const batch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(batch).toHaveLength(1);

    await reader.releaseLease(event.id, 'Temporary subscriber failure');

    const retriedBatch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(retriedBatch).toHaveLength(1);
    expect(retriedBatch[0].attempts).toBe(1);
    expect(retriedBatch[0].lastError).toBe('Temporary subscriber failure');
  });

  it('marks published records as completed and prevents re-acquisition', async () => {
    const event = createMockDomainEvent();
    await reader.enqueue([event]);

    const batch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(batch).toHaveLength(1);

    await reader.markPublished(event.id);

    const postPublishBatch = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
    });
    expect(postPublishBatch).toHaveLength(0);
  });

  it('enforces tenant workspace and organization isolation during lease acquisition (Rule 47)', async () => {
    const eventOrg1 = createMockDomainEvent({ organizationId: 'org_alpha', workspaceId: 'ws_alpha' });
    const eventOrg2 = createMockDomainEvent({ organizationId: 'org_beta', workspaceId: 'ws_beta' });

    await reader.enqueue([eventOrg1, eventOrg2]);

    const batchOrgAlpha = await reader.acquireLeasedBatch({
      batchSize: 10,
      leaseDurationMs: 60000,
      organizationId: 'org_alpha',
    });

    expect(batchOrgAlpha).toHaveLength(1);
    expect(batchOrgAlpha[0].event.organizationId).toBe('org_alpha');
  });
});
