import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  convertLegacyActivityToDomainEvent,
  bridgeLegacyActivityToEventBackbone,
} from '@/platform/events/adapters/legacy-activity-strangler';
import { defaultEventBus } from '@/platform/events/event-bus';
import type { Activity } from '@/lib/types';

describe('LegacyActivityStrangler: Anti-Distortion Bridge (Rules 1, 4, 60, 64, 69)', () => {
  type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

  beforeEach(() => {
    defaultEventBus.clear();
  });

  const baseInput: LogActivityInput = {
    organizationId: 'org-test',
    workspaceId: 'ws-test',
    type: 'contact_created',
    description: 'Created contact John Connor',
    userId: 'usr-admin',
    entityId: 'cnt-100',
    entityType: 'person',
    entityName: 'John Connor',
    displayName: 'John Connor',
    source: 'manual',
    metadata: {
      source: 'web-form',
    },
  };

  it('maps legacy contact_created to canonical crm.contact.created DomainEvent', () => {
    const event = convertLegacyActivityToDomainEvent(baseInput);

    expect(event.type).toBe('crm.contact.created');
    expect(event.organizationId).toBe('org-test');
    expect(event.workspaceId).toBe('ws-test');
    expect(event.actor.type).toBe('user');
    expect(event.actor.id).toBe('usr-admin');
    expect(event.entity.type).toBe('person');
    expect(event.entity.id).toBe('cnt-100');
    expect(event.payload.name).toBe('John Connor');
    expect(event.source).toBe('legacy-activity-logger');
  });

  it('maps automation and system actors correctly from legacy metadata', () => {
    const autoInput: LogActivityInput = {
      ...baseInput,
      metadata: { isAutomation: true },
    };
    const autoEvent = convertLegacyActivityToDomainEvent(autoInput);
    expect(autoEvent.actor.type).toBe('automation');

    const sysInput: LogActivityInput = {
      ...baseInput,
      source: 'system',
    };
    const sysEvent = convertLegacyActivityToDomainEvent(sysInput);
    expect(sysEvent.actor.type).toBe('system');
  });

  it('bridges legacy activities to EventBus without disrupting callers (Rule 69)', async () => {
    const subscriber = vi.fn().mockResolvedValue(undefined);
    defaultEventBus.subscribe('crm.contact.created', subscriber);

    await bridgeLegacyActivityToEventBackbone(baseInput);

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.contact.created',
        organizationId: 'org-test',
      })
    );
  });

  it('fails open if EventBus throws an error, safeguarding legacy flow (Rule 69)', async () => {
    const failingSub = vi.fn().mockRejectedValue(new Error('Sink failure'));
    defaultEventBus.subscribe('crm.contact.created', failingSub);

    // Must not throw
    await expect(bridgeLegacyActivityToEventBackbone(baseInput)).resolves.not.toThrow();
  });
});
