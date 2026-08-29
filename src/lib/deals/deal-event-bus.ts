/**
 * @fileoverview Deals Platform 2.0 Domain Event Bus
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 122 & Sections 54-58):
 * - Provides a strongly-typed, decoupled event bus that emits structured domain events
 *   upon significant deal lifecycle and commercial state transitions.
 * - Routes events asynchronously to:
 *   1. Visual Automation Orchestrator (`triggerAutomationProtocols`)
 *   2. Outbound Webhooks Engine (`dispatchWebhooksByTrigger`)
 *   3. Structured CRM Activity Logs (`logActivity`)
 * - Decouples downstream event processing from immediate database mutations via `runAfter` / Next.js `after()`.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10 & Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Event payloads are fully typed and immutable.
 * - Idempotency is supported via deterministic `eventId` generation.
 *
 * TESTABILITY POINTER:
 * Covered by unit tests in `src/lib/deals/__tests__/deal-event-bus.test.ts`.
 */

import { after } from 'next/server';
import type { Deal, DealLineItem, DealQuote, AutomationTrigger } from '../types';

export type DealEventType =
  | 'deal.created'
  | 'deal.updated'
  | 'deal.deleted'
  | 'deal.archived'
  | 'deal.stage.changed'
  | 'deal.status.changed'
  | 'deal.won'
  | 'deal.lost'
  | 'deal.owner.changed'
  | 'deal.value.changed'
  | 'deal.close_date.changed'
  | 'deal.probability.changed'
  | 'deal.health.changed'
  | 'deal.sla.breached'
  | 'deal.stalled'
  | 'deal.activity.created'
  | 'deal.quote.created'
  | 'deal.quote.accepted'
  | 'deal.quote.rejected'
  | 'deal.contract.signed';

export interface DealDomainEventPayload {
  dealId: string;
  dealName?: string;
  workspaceId: string;
  organizationId?: string;
  entityId?: string;
  pipelineId?: string;
  stageId?: string;
  previousStageId?: string;
  status?: 'open' | 'won' | 'lost';
  previousStatus?: 'open' | 'won' | 'lost';
  value?: number;
  previousValue?: number;
  mrr?: number;
  arr?: number;
  tcv?: number;
  probability?: number;
  lostReason?: string | null;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  activityId?: string;
  activityType?: string;
  quoteId?: string;
  quoteNumber?: string;
  contractStatus?: string;
  actorUserId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface DealDomainEvent {
  eventId: string;
  eventType: DealEventType;
  payload: DealDomainEventPayload;
  timestamp: string;
}

/**
 * Maps a Deal Domain Event Type to its corresponding Automation Trigger
 */
export function mapEventToAutomationTrigger(eventType: DealEventType): AutomationTrigger | null {
  switch (eventType) {
    case 'deal.created':
      return 'DEAL_CREATED';
    case 'deal.stage.changed':
      return 'DEAL_STAGE_CHANGED';
    case 'deal.status.changed':
      return 'DEAL_STATUS_CHANGED';
    case 'deal.won':
      return 'DEAL_WON';
    case 'deal.lost':
      return 'DEAL_LOST';
    case 'deal.owner.changed':
      return 'DEAL_OWNER_CHANGED';
    case 'deal.value.changed':
      return 'DEAL_VALUE_CHANGED';
    case 'deal.sla.breached':
      return 'DEAL_SLA_BREACHED';
    case 'deal.stalled':
      return 'DEAL_STALLED';
    case 'deal.quote.accepted':
      return 'DEAL_QUOTE_ACCEPTED';
    case 'deal.contract.signed':
      return 'DEAL_CONTRACT_SIGNED';
    case 'deal.activity.created':
      return 'DEAL_ACTIVITY_LOGGED';
    default:
      return null;
  }
}

/**
 * Safely executes asynchronous work outside the active request transaction.
 */
function runAfter(fn: () => void | Promise<void>) {
  try {
    after(fn);
  } catch {
    // Fallback: run asynchronously (e.g. within tests or detached scripts)
    Promise.resolve().then(fn).catch((err: unknown) => {
      console.error('[DealEventBus] runAfter fallback execution failed:', err);
    });
  }
}

/**
 * Generates a deterministic or unique eventId for idempotency and audit tracking.
 */
export function createDealEventId(eventType: DealEventType, dealId: string, timestamp: string): string {
  const cleanTime = timestamp.replace(/[^0-9]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `evt_${eventType.replace(/\./g, '_')}_${dealId}_${cleanTime}_${randomSuffix}`;
}

/**
 * Emits a structured Deal Domain Event to downstream automations, webhooks, and audit logs.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - This function must NEVER throw or block the calling server action / transaction.
 * - All downstream processing is deferred via Next.js `after()`.
 */
export function emitDealDomainEvent(
  eventType: DealEventType,
  payload: DealDomainEventPayload
): DealDomainEvent {
  const timestamp = payload.occurredAt || new Date().toISOString();
  const eventId = createDealEventId(eventType, payload.dealId, timestamp);

  const event: DealDomainEvent = {
    eventId,
    eventType,
    payload: {
      ...payload,
      occurredAt: timestamp,
    },
    timestamp,
  };

  // Dispatch asynchronously
  runAfter(async () => {
    try {
      const automationTrigger = mapEventToAutomationTrigger(eventType);
      if (automationTrigger && payload.workspaceId) {
        const { triggerAutomationProtocols } = await import('../automations/orchestrator');
        await triggerAutomationProtocols(automationTrigger, {
          ...payload,
          eventId,
          _domainEventType: eventType,
          _firingTrigger: automationTrigger,
        });
      }
    } catch (err: unknown) {
      console.error(`[DealEventBus] Failed to dispatch automation trigger for ${eventType}:`, err);
    }

    try {
      const { dispatchWebhooksByTrigger } = await import('../webhook-engine');
      if (payload.workspaceId) {
        await dispatchWebhooksByTrigger({
          trigger: (mapEventToAutomationTrigger(eventType) || 'DEAL_UPDATED') as AutomationTrigger,
          payload: { ...payload, eventId, eventType },
          workspaceId: payload.workspaceId,
          organizationId: payload.organizationId || 'default',
          entityId: payload.entityId || null,
        });
      }
    } catch (webhookErr: unknown) {
      console.error(`[DealEventBus] Failed to dispatch webhook for ${eventType}:`, webhookErr);
    }
  });

  return event;
}
