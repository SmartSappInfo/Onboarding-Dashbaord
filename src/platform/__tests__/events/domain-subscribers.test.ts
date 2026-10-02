import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { createCrmActivitySubscriber } from '@/platform/events/subscribers/crm-activity-subscriber';
import { createDealsActivitySubscriber } from '@/platform/events/subscribers/deals-activity-subscriber';
import { createTasksActivitySubscriber } from '@/platform/events/subscribers/tasks-activity-subscriber';
import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { createInMemoryActivityStorage, createActivityAggregationService } from '@/platform/events/activity/activity-aggregation-service';
import { createProductionEventBusSink } from '@/platform/tasks/event-dispatcher-worker';

describe('Domain Subscribers & Worker Integration (Rules 4, 18, 24, 27, 47)', () => {
  let bus: EventBus;
  let mockDbUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bus = createEventBus();
    mockDbUpdate = vi.fn().mockResolvedValue(undefined);
  });

  const sampleEvent = (type: string, entityType: string, entityId: string, payload: Record<string, unknown> = {}): DomainEvent =>
    createDomainEvent({
      type,
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: entityType, id: entityId },
      payload,
      correlationId: 'trace-sub-1',
      source: 'test-suite',
    });

  it('CrmActivitySubscriber updates contact lastActivityAt on crm.contact.updated', async () => {
    const subscriber = createCrmActivitySubscriber({ onUpdateContact: mockDbUpdate });
    bus.subscribe('crm.*', subscriber.handleEvent);

    const event = sampleEvent('crm.contact.updated', 'contact', 'cnt-777', { name: 'Sarah' });
    const result = await bus.publish(event);

    expect(result.deliveredCount).toBe(1);
    expect(mockDbUpdate).toHaveBeenCalledWith({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      contactId: 'cnt-777',
      lastActivityAt: event.timestamp,
    });
  });

  it('DealsActivitySubscriber updates deal stage velocity and timestamp on deal.stage_changed', async () => {
    const subscriber = createDealsActivitySubscriber({ onUpdateDeal: mockDbUpdate });
    bus.subscribe('deal.*', subscriber.handleEvent);

    const event = sampleEvent('deal.stage_changed', 'deal', 'deal-101', { newStage: 'Negotiation' });
    const result = await bus.publish(event);

    expect(result.deliveredCount).toBe(1);
    expect(mockDbUpdate).toHaveBeenCalledWith({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      dealId: 'deal-101',
      stage: 'Negotiation',
      lastStageChangeAt: event.timestamp,
    });
  });

  it('TasksActivitySubscriber updates task status on task.completed', async () => {
    const subscriber = createTasksActivitySubscriber({ onUpdateTask: mockDbUpdate });
    bus.subscribe('task.*', subscriber.handleEvent);

    const event = sampleEvent('task.completed', 'task', 'task-555');
    const result = await bus.publish(event);

    expect(result.deliveredCount).toBe(1);
    expect(mockDbUpdate).toHaveBeenCalledWith({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      taskId: 'task-555',
      completedAt: event.timestamp,
    });
  });

  it('Production EventBus sink in Dispatcher Worker materializes activity and routes through bus', async () => {
    const storage = createInMemoryActivityStorage();
    const aggregator = createActivityAggregationService(storage);

    const domainSubscriber = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('crm.*', domainSubscriber);

    const sink = createProductionEventBusSink(bus, aggregator);
    const event = sampleEvent('crm.contact.created', 'contact', 'cnt-888', { name: 'Kyle Reese' });

    await sink(event);

    // 1. Bus should have delivered to subscriber
    expect(domainSubscriber).toHaveBeenCalledTimes(1);

    // 2. Storage should have materialized ActivityRecordV2
    const activities = await storage.listActivities({ organizationId: 'org-test' });
    expect(activities).toHaveLength(1);
    expect(activities[0]?.summary).toBe('User usr-1 created contact Kyle Reese');
  });
});
