/**
 * @fileoverview Unit Tests for Deals Platform 2.0 Domain Event Bus
 *
 * WORKSPACE RULES & TESTING:
 * - Strict typing: Zero 'any' or 'any[]'.
 * - Tests deterministic eventId generation, automation trigger mapping, and payload integrity.
 */

import { describe, it, expect } from 'vitest';
import {
  mapEventToAutomationTrigger,
  createDealEventId,
  emitDealDomainEvent,
  type DealEventType,
} from '../deal-event-bus';

describe('DealDomainEvent Bus', () => {
  describe('mapEventToAutomationTrigger', () => {
    it('maps all major deal domain events to automation triggers', () => {
      expect(mapEventToAutomationTrigger('deal.created')).toBe('DEAL_CREATED');
      expect(mapEventToAutomationTrigger('deal.stage.changed')).toBe('DEAL_STAGE_CHANGED');
      expect(mapEventToAutomationTrigger('deal.status.changed')).toBe('DEAL_STATUS_CHANGED');
      expect(mapEventToAutomationTrigger('deal.won')).toBe('DEAL_WON');
      expect(mapEventToAutomationTrigger('deal.lost')).toBe('DEAL_LOST');
      expect(mapEventToAutomationTrigger('deal.owner.changed')).toBe('DEAL_OWNER_CHANGED');
      expect(mapEventToAutomationTrigger('deal.value.changed')).toBe('DEAL_VALUE_CHANGED');
      expect(mapEventToAutomationTrigger('deal.sla.breached')).toBe('DEAL_SLA_BREACHED');
      expect(mapEventToAutomationTrigger('deal.stalled')).toBe('DEAL_STALLED');
      expect(mapEventToAutomationTrigger('deal.quote.accepted')).toBe('DEAL_QUOTE_ACCEPTED');
      expect(mapEventToAutomationTrigger('deal.contract.signed')).toBe('DEAL_CONTRACT_SIGNED');
      expect(mapEventToAutomationTrigger('deal.activity.created')).toBe('DEAL_ACTIVITY_LOGGED');
    });

    it('returns null for internal unmapped events', () => {
      expect(mapEventToAutomationTrigger('deal.deleted' as DealEventType)).toBeNull();
    });
  });

  describe('createDealEventId', () => {
    it('generates a clean, deterministic event identifier', () => {
      const eventId = createDealEventId('deal.stage.changed', 'deal-123', '2026-08-29T10:00:00.000Z');
      expect(eventId).toMatch(/^evt_deal_stage_changed_deal-123_20260829100000000_[a-z0-9]+$/);
    });
  });

  describe('emitDealDomainEvent', () => {
    it('constructs and returns an immutable DealDomainEvent structure', () => {
      const event = emitDealDomainEvent('deal.won', {
        dealId: 'deal-999',
        dealName: 'Acme Enterprise',
        workspaceId: 'ws-1',
        value: 50000,
        status: 'won',
      });

      expect(event.eventId).toBeDefined();
      expect(event.eventType).toBe('deal.won');
      expect(event.payload.dealId).toBe('deal-999');
      expect(event.payload.value).toBe(50000);
      expect(event.timestamp).toBeDefined();
    });
  });
});
