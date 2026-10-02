import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent, type DomainEvent } from '@/platform/capabilities/events/domain-event';

describe('EventBus: Universal Multi-Tenant Reactive Router (Rules 4, 8, 24, 39, 41, 47)', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createEventBus();
  });

  const sampleEvent = (type: string, orgId = 'org-1', wsId: string | null = 'ws-1'): DomainEvent =>
    createDomainEvent({
      type,
      organizationId: orgId,
      workspaceId: wsId,
      actor: { type: 'user', id: 'usr-123' },
      entity: { type: 'contact', id: 'cnt-456' },
      payload: { name: 'Sarah Connor', status: 'lead' },
      correlationId: 'trace-abc-123',
      causationId: 'cause-xyz-789',
      source: 'test-suite',
    });

  it('delivers events to exact matching pattern subscribers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('crm.contact.created', handler);

    const result = await bus.publish(sampleEvent('crm.contact.created'));

    expect(result.deliveredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.contact.created',
        correlationId: 'trace-abc-123',
      })
    );
  });

  it('delivers events matching domain wildcards (crm.*) but ignores unrelated domains', async () => {
    const crmHandler = vi.fn().mockResolvedValue(undefined);
    const dealHandler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('crm.*', crmHandler);
    bus.subscribe('deal.*', dealHandler);

    await bus.publish(sampleEvent('crm.contact.created'));
    await bus.publish(sampleEvent('crm.contact.updated'));
    await bus.publish(sampleEvent('deal.stage_changed'));

    expect(crmHandler).toHaveBeenCalledTimes(2);
    expect(dealHandler).toHaveBeenCalledTimes(1);
  });

  it('delivers all events to universal wildcard (*) subscribers', async () => {
    const universalHandler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('*', universalHandler);

    await bus.publish(sampleEvent('crm.contact.created'));
    await bus.publish(sampleEvent('deal.stage_changed'));
    await bus.publish(sampleEvent('portal.membership.subscribed'));

    expect(universalHandler).toHaveBeenCalledTimes(3);
  });

  it('enforces strict multi-tenant boundary isolation (Rule 47)', async () => {
    const org1Handler = vi.fn().mockResolvedValue(undefined);
    const ws1Handler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('crm.*', org1Handler, { organizationId: 'org-1' });
    bus.subscribe('crm.*', ws1Handler, { organizationId: 'org-1', workspaceId: 'ws-1' });

    // Event from org-2: must not be delivered to org-1 or ws-1 subscribers
    const eventOrg2 = sampleEvent('crm.contact.created', 'org-2', 'ws-1');
    const resultOrg2 = await bus.publish(eventOrg2);
    expect(resultOrg2.deliveredCount).toBe(0);
    expect(org1Handler).not.toHaveBeenCalled();
    expect(ws1Handler).not.toHaveBeenCalled();

    // Event from org-1, ws-2: delivered to org1Handler, but NOT to ws1Handler
    const eventWs2 = sampleEvent('crm.contact.created', 'org-1', 'ws-2');
    const resultWs2 = await bus.publish(eventWs2);
    expect(resultWs2.deliveredCount).toBe(1);
    expect(org1Handler).toHaveBeenCalledTimes(1);
    expect(ws1Handler).not.toHaveBeenCalled();
  });

  it('isolates subscriber errors so a failing handler does not abort other subscribers (Rule 24)', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('Downstream webhook 503 Service Unavailable'));
    const healthyHandler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('crm.*', failingHandler, { name: 'failing-webhook' });
    bus.subscribe('crm.*', healthyHandler, { name: 'healthy-subscriber' });

    const result = await bus.publish(sampleEvent('crm.contact.created'));

    expect(result.deliveredCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.handlerName).toBe('failing-webhook');
    expect(result.errors[0]?.error).toContain('Downstream webhook 503');
    expect(healthyHandler).toHaveBeenCalledTimes(1);
  });

  it('allows subscribers to unsubscribe cleanly without memory leaks', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const subscription = bus.subscribe('crm.*', handler);

    await bus.publish(sampleEvent('crm.contact.created'));
    expect(handler).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();

    await bus.publish(sampleEvent('crm.contact.updated'));
    expect(handler).toHaveBeenCalledTimes(1); // not called again
  });
});
