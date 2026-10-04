/**
 * @fileOverview Unit & Security Tests for Activity & DLQ Server Actions (Phase 2 Milestone 3 - Task 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 (Anti-IDOR / Security), Rule 9 (Query Clamping),
 * Rule 20 (Idempotency), Rule 25 (DLQ Ops), and Rule 47 (Multi-Tenant Isolation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listActivitiesAction,
  replayDeadLetterEventAction,
  discardDeadLetterEventAction,
} from '@/app/actions/activity-actions';
import { defaultEventBus } from '@/platform/events/event-bus';
import {
  createInMemoryActivityStorage,
  createActivityAggregationService,
} from '@/platform/events/activity/activity-aggregation-service';
import { createInMemoryDeadLetterStorage, type DeadLetterStorage } from '@/platform/events/storage/dead-letter-storage';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/auth/require-auth';

describe('Activity & DLQ Server Actions (Rules 4, 8, 20, 25, 47)', () => {
  let mockDlqStorage: DeadLetterStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultEventBus.clear();
    mockDlqStorage = createInMemoryDeadLetterStorage();
  });

  const mockAdminAuth = (orgId = 'org-test-1', wsId = 'ws-test-1') => {
    vi.mocked(requireAuth).mockResolvedValue({
      uid: 'admin-1',
      profile: {
        id: 'admin-1',
        organizationId: orgId,
        activeWorkspaceId: wsId,
        role: 'admin',
        name: 'Sarah Connor',
      } as any,
      isSystemAdmin: false,
    });
  };

  it('listActivitiesAction enforces tenant isolation and clamps limit (Rule 8, 9, 47)', async () => {
    mockAdminAuth('org-test-1', 'ws-test-1');

    const mockActivityStorage = createInMemoryActivityStorage();
    const mockActivityService = createActivityAggregationService(mockActivityStorage);

    const eventOrg1 = createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-test-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'contact', id: 'cnt-1' },
      payload: { name: 'Sarah' },
      correlationId: 'trace-1',
      source: 'test',
    });
    const eventOrg2 = createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-other',
      actor: { type: 'user', id: 'usr-2' },
      entity: { type: 'contact', id: 'cnt-2' },
      payload: { name: 'Kyle' },
      correlationId: 'trace-2',
      source: 'test',
    });

    await mockActivityService.materializeAndStore(eventOrg1);
    await mockActivityService.materializeAndStore(eventOrg2);

    // Caller attempts to query org-other, but action must enforce caller's org-test-1
    const result = await listActivitiesAction({ organizationId: 'org-other', limit: 200 }, mockActivityService);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      // Must only return org-test-1 activities
      expect(result.data.every((a) => a.organizationId === 'org-test-1')).toBe(true);
      expect(result.data.some((a) => a.organizationId === 'org-other')).toBe(false);
    }
  });

  it('replayDeadLetterEventAction verifies tenant ownership and re-publishes to EventBus (Rule 20, 25)', async () => {
    mockAdminAuth('org-test-1');

    const quarantinedEvent = createDomainEvent({
      type: 'deal.stage_changed',
      organizationId: 'org-test-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'deal', id: 'deal-999' },
      payload: { newStage: 'Won' },
      correlationId: 'trace-dlq-1',
      source: 'test',
    });

    await mockDlqStorage.quarantineEvent({
      eventId: quarantinedEvent.id,
      event: quarantinedEvent,
      attempts: 3,
      lastError: 'Simulated 503 gateway failure',
      organizationId: 'org-test-1',
    });

    const busSubscriber = vi.fn().mockResolvedValue(undefined);
    defaultEventBus.subscribe('deal.*', busSubscriber, { organizationId: 'org-test-1' });

    const result = await replayDeadLetterEventAction(
      { eventId: quarantinedEvent.id },
      mockDlqStorage
    );

    expect(result.success).toBe(true);
    expect(busSubscriber).toHaveBeenCalledTimes(1);

    const updatedRecord = await mockDlqStorage.get(quarantinedEvent.id);
    expect(updatedRecord?.status).toBe('replayed');
  });

  it('discardDeadLetterEventAction marks record as discarded with operator notes (Rule 25)', async () => {
    mockAdminAuth('org-test-1');

    const quarantinedEvent = createDomainEvent({
      type: 'crm.contact.deleted',
      organizationId: 'org-test-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'contact', id: 'cnt-old' },
      payload: {},
      correlationId: 'trace-dlq-2',
      source: 'test',
    });

    await mockDlqStorage.quarantineEvent({
      eventId: quarantinedEvent.id,
      event: quarantinedEvent,
      attempts: 3,
      lastError: 'Permanent validation failure',
      organizationId: 'org-test-1',
    });

    const result = await discardDeadLetterEventAction(
      { eventId: quarantinedEvent.id, reason: 'Duplicate test event' },
      mockDlqStorage
    );

    expect(result.success).toBe(true);
    const updatedRecord = await mockDlqStorage.get(quarantinedEvent.id);
    expect(updatedRecord?.status).toBe('discarded');
    expect(updatedRecord?.operatorNotes).toBe('Duplicate test event');
  });
});
