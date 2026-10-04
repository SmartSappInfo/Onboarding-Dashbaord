/**
 * @fileOverview Unit & Boundary Test Suite for AccountTimelineService (Phase 9 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 (Multi-Tenant Cache Partitioning),
 * Rule 40 (Domain Event Emission on Assembly), Rule 50 (Tenant Cache Isolation),
 * and Rule 69 (Universal Timeline Normalization).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountTimelineService } from '../../../agents/crm/context/account-timeline-service';
import type { Account360Context, AccountTimelineItem } from '../../../agents/crm/context/account-context-types';
import { createEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

describe('AccountTimelineService (Milestone 1)', () => {
  let service: AccountTimelineService;
  let testEventBus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    testEventBus = createEventBus();
    service = new AccountTimelineService({
      eventBus: testEventBus,
      defaultTtlMs: 180000, // 3 minutes
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it('normalizes heterogeneous domain events into chronological order', () => {
    const mockContext: Partial<Account360Context> = {
      notes: [
        {
          id: 'n1',
          content: 'Discussed renewal terms',
          authorName: 'Alice',
          createdAt: '2026-10-02T10:00:00Z',
          category: 'commercial',
        },
      ],
      meetings: [
        {
          id: 'm1',
          title: 'Board Meeting',
          startTime: '2026-10-03T15:00:00Z',
          attendees: ['alice@smartsapp.com'],
          summary: 'Approved roadmap',
          sentiment: 'positive',
        },
      ],
      deals: [
        {
          id: 'd1',
          title: 'Upgrade Deal',
          pipelineId: 'p1',
          stageId: 's1',
          stageName: 'Negotiation',
          value: 20000,
          currency: 'USD',
          probability: 70,
          ageInDays: 10,
          expectedCloseDate: '2026-10-05T12:00:00Z',
          isStalled: false,
        },
      ],
      tasks: [
        {
          id: 't1',
          title: 'Send invoice',
          status: 'completed',
          priority: 'medium',
          dueDate: '2026-10-01T12:00:00Z',
          assignedToName: 'Alice',
          isOverdue: false,
        },
      ],
    };

    const timeline = service.normalizeTimeline(mockContext as Account360Context);

    expect(timeline.length).toBe(4);
    // Verifies chronological descending sort
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = new Date(timeline[i].timestamp).getTime();
      const next = new Date(timeline[i + 1].timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }

    // Verify categories
    const meetingItem = timeline.find((t) => t.sourceRef.type === 'meeting');
    expect(meetingItem?.category).toBe('ENGAGEMENT');

    const noteItem = timeline.find((t) => t.sourceRef.type === 'note');
    expect(noteItem?.category).toBe('COMMERCIAL');

    const taskItem = timeline.find((t) => t.sourceRef.type === 'task');
    expect(taskItem?.category).toBe('OPERATIONAL');
  });

  it('caches assembled timeline with 3-minute TTL and invalidates on EventBus event', async () => {
    const key = { orgId: 'org_1', wsId: 'ws_1', entityId: 'ent_1' };
    const timeline: AccountTimelineItem[] = [
      {
        id: 'tl_1',
        timestamp: new Date().toISOString(),
        category: 'COMMERCIAL',
        title: 'Test Note',
        summary: 'Test summary',
        actor: 'Alice',
        sourceRef: { type: 'note', id: 'n1' },
      },
    ];

    service.setCachedTimeline(key.orgId, key.wsId, key.entityId, timeline);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toEqual(timeline);

    // Manual invalidation
    service.invalidateCache(key.orgId, key.wsId, key.entityId);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toBeNull();

    // Re-cache and verify reactive invalidation via EventBus
    service.setCachedTimeline(key.orgId, key.wsId, key.entityId, timeline);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toEqual(timeline);

    // Publish event
    await testEventBus.publish(
      createDomainEvent({
        type: 'crm.activity.created',
        organizationId: key.orgId,
        workspaceId: key.wsId,
        actor: { type: 'user', id: 'user_1' },
        entity: { type: 'entity', id: key.entityId },
        correlationId: 'corr_test_1',
        source: 'crm-test',
        payload: { entityId: key.entityId },
      })
    );

    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toBeNull();
  });

  it('respects TTL expiration on cache read', async () => {
    const key = { orgId: 'org_1', wsId: 'ws_1', entityId: 'ent_1' };
    const timeline: AccountTimelineItem[] = [
      {
        id: 'tl_1',
        timestamp: new Date().toISOString(),
        category: 'COMMERCIAL',
        title: 'Test Note',
        summary: 'Test summary',
        actor: 'Alice',
        sourceRef: { type: 'note', id: 'n1' },
      },
    ];

    // Cache with 5ms TTL
    service.setCachedTimeline(key.orgId, key.wsId, key.entityId, timeline, 5);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toEqual(timeline);

    // Wait 15ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toBeNull();
  });

  it('emits domain events on timeline assembly (Rule 40)', async () => {
    let capturedEvent: unknown = null;
    testEventBus.subscribe('crm.timeline.assembled', (event) => {
      capturedEvent = event;
    });

    await service.publishTimelineAssembled('org_1', 'ws_1', 'ent_1', 5, 'corr_123');

    expect(capturedEvent).toBeDefined();
    expect((capturedEvent as { type: string }).type).toBe('crm.timeline.assembled');
    expect((capturedEvent as { payload: { itemCount: number } }).payload.itemCount).toBe(5);
  });
});
