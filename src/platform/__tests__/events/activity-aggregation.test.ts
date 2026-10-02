import { describe, it, expect, beforeEach } from 'vitest';
import {
  createActivityAggregationService,
  createInMemoryActivityStorage,
  type ActivityAggregationService,
  type ActivityStorage,
} from '@/platform/events/activity/activity-aggregation-service';
import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';
import { buildActivityDocumentId } from '@/platform/events/contracts/activity-record.contract';

describe('ActivityAggregationService: Event Materialization & Append-Only Timeline (Rules 4, 7, 9, 11, 20, 40)', () => {
  let storage: ActivityStorage;
  let service: ActivityAggregationService;

  beforeEach(() => {
    storage = createInMemoryActivityStorage();
    service = createActivityAggregationService(storage);
  });

  const sampleEvent = (overrides?: Partial<Parameters<typeof createDomainEvent>[0]>): DomainEvent =>
    createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-test',
      workspaceId: 'ws-sales',
      actor: { type: 'user', id: 'usr-123' },
      entity: { type: 'contact', id: 'cnt-999' },
      payload: { name: 'John Connor', title: 'Leader' },
      correlationId: 'trace-456',
      source: 'crm-test',
      ...overrides,
    });

  it('materializes a canonical DomainEvent into an ActivityRecordV2 and stores it', async () => {
    const event = sampleEvent();
    const record = await service.materializeAndStore(event, { userName: 'Joseph Aidoo' });

    expect(record.id).toBe(buildActivityDocumentId('org-test', event.id));
    expect(record.eventId).toBe(event.id);
    expect(record.organizationId).toBe('org-test');
    expect(record.workspaceId).toBe('ws-sales');
    expect(record.eventType).toBe('crm.contact.created');
    expect(record.actor.displayName).toBe('Joseph Aidoo');
    expect(record.summary).toBe('Joseph Aidoo created contact John Connor');
    expect(record.correlationId).toBe('trace-456');

    // Verify it can be retrieved from storage
    const stored = await storage.getActivity(record.id);
    expect(stored).not.toBeNull();
    expect(stored?.id).toBe(record.id);
  });

  it('enforces deterministic idempotent writes (Rule 20)', async () => {
    const event = sampleEvent();

    // Materialize first time
    const record1 = await service.materializeAndStore(event);
    // Materialize same event second time (e.g. Cloud Tasks retry)
    const record2 = await service.materializeAndStore(event);

    expect(record1.id).toBe(record2.id);

    const list = await storage.listActivities({ organizationId: 'org-test' });
    expect(list).toHaveLength(1); // Deduplicated by deterministic key
  });

  it('enforces bounded queries with default and max limit clamping (Rule 9)', async () => {
    // Generate 10 events
    for (let i = 0; i < 10; i++) {
      const event = sampleEvent({
        payload: { name: `Contact ${i}` },
      });
      await service.materializeAndStore(event);
    }

    // Default limit should return all 10
    const listDefault = await storage.listActivities({ organizationId: 'org-test' });
    expect(listDefault.length).toBe(10);

    // Limit capped at 3
    const listCapped = await storage.listActivities({ organizationId: 'org-test', limit: 3 });
    expect(listCapped.length).toBe(3);
  });

  it('filters activities by workspace when specified (Rule 47)', async () => {
    await service.materializeAndStore(sampleEvent({ workspaceId: 'ws-sales' }));
    await service.materializeAndStore(sampleEvent({ workspaceId: 'ws-marketing' }));

    const salesActivities = await storage.listActivities({
      organizationId: 'org-test',
      workspaceId: 'ws-sales',
    });
    expect(salesActivities).toHaveLength(1);
    expect(salesActivities[0]?.workspaceId).toBe('ws-sales');

    const allOrgActivities = await storage.listActivities({
      organizationId: 'org-test',
    });
    expect(allOrgActivities).toHaveLength(2);
  });
});
