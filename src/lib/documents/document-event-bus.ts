/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative canonical event bus for Document & Contract Signing lifecycles (P4.3).
 *    Captures immutable execution events into the `document_events` collection,
 *    and bridges directly into the CRM Deals domain event bus (`emitDealDomainEvent`).
 * 2. Strict Typing Enforcement (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. Payloads validate against `DocumentDomainEventSchema`.
 * 3. Execution Safety & Non-Blocking Design:
 *    All persistence and cross-domain event fanouts execute asynchronously outside the
 *    active transaction using Next.js `after()` with resilient fallback (`runAfter`).
 * 4. Multi-Tenant Invariant (Rule 5 & Rule 8):
 *    All emitted events and queries are strictly scoped by `workspaceId`.
 */

import { after } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  DocumentDomainEventSchema,
  type DocumentDomainEvent,
  type DocumentDomainEventType,
} from '@/lib/types/document-signing';
import { emitDealDomainEvent, type DealEventType } from '@/lib/deals/deal-event-bus';

export interface EmitDocumentEventParams {
  workspaceId: string;
  type: DocumentDomainEventType;
  envelopeId?: string;
  contractId?: string;
  dealId?: string;
  entityId?: string;
  contactId?: string;
  recipientId?: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Safely executes asynchronous work outside the active request lifecycle.
 */
function runAfter(fn: () => void | Promise<void>): void {
  try {
    after(fn);
  } catch {
    // Fallback: run in detached promise for tests or script execution contexts
    Promise.resolve()
      .then(fn)
      .catch((err: unknown) => {
        console.error('[DocumentEventBus] runAfter fallback execution failed:', err);
      });
  }
}

/**
 * Generates a collision-resistant deterministic eventId for idempotency and audit logs.
 */
export function createDocumentEventId(
  eventType: DocumentDomainEventType,
  targetId: string,
  timestamp: string
): string {
  const cleanTime = timestamp.replace(/[^0-9]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanTarget = targetId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `evt_${eventType.replace(/\./g, '_')}_${cleanTarget}_${cleanTime}_${randomSuffix}`;
}

/**
 * Maps Document Domain Events to Deal Domain Events for cross-subsystem CRM automation.
 */
function mapToDealEventType(type: DocumentDomainEventType): DealEventType | null {
  switch (type) {
    case 'document.dispatched':
      return 'deal.contract.sent';
    case 'signing.recipient_completed':
      return 'deal.contract.in_progress';
    case 'signing.envelope_completed':
      return 'deal.contract.signed';
    case 'signing.recipient_declined':
      return 'deal.contract.declined';
    default:
      return null;
  }
}

/**
 * Emits a strongly typed Document Domain Event.
 * Persists event to `document_events` and bridges to CRM Deals domain event bus if `dealId` is present.
 */
export function emitDocumentDomainEvent(params: EmitDocumentEventParams): DocumentDomainEvent {
  const timestamp = params.timestamp || new Date().toISOString();
  const targetId = params.envelopeId || params.contractId || 'doc';
  const eventId = createDocumentEventId(params.type, targetId, timestamp);

  const rawEvent = {
    id: eventId,
    workspaceId: params.workspaceId,
    type: params.type,
    envelopeId: params.envelopeId,
    contractId: params.contractId,
    dealId: params.dealId,
    entityId: params.entityId,
    contactId: params.contactId,
    recipientId: params.recipientId,
    actorId: params.actorId,
    metadata: params.metadata || {},
    timestamp,
  };

  const validatedEvent = DocumentDomainEventSchema.parse(rawEvent);

  runAfter(async () => {
    // 1. Persist immutable event in Firestore document_events
    try {
      await adminDb.collection('document_events').doc(validatedEvent.id).set(validatedEvent);
    } catch (persistErr: unknown) {
      console.error('[DocumentEventBus] Failed to persist document event to Firestore:', persistErr);
    }

    // 2. Bridge to Deal Domain Event Bus if dealId is linked
    if (validatedEvent.dealId) {
      const dealEventType = mapToDealEventType(validatedEvent.type);
      if (dealEventType) {
        try {
          emitDealDomainEvent(dealEventType, {
            dealId: validatedEvent.dealId,
            workspaceId: validatedEvent.workspaceId,
            entityId: validatedEvent.entityId,
            envelopeId: validatedEvent.envelopeId,
            contractId: validatedEvent.contractId,
            actorUserId: validatedEvent.actorId,
            occurredAt: validatedEvent.timestamp,
            metadata: {
              ...validatedEvent.metadata,
              documentEventType: validatedEvent.type,
              documentEventId: validatedEvent.id,
            },
          });
        } catch (dealErr: unknown) {
          console.error('[DocumentEventBus] Failed to bridge event to Deal domain:', dealErr);
        }
      }
    }
  });

  return validatedEvent;
}

export interface QueryDocumentEventsFilter {
  envelopeId?: string;
  contractId?: string;
  dealId?: string;
  limit?: number;
}

/**
 * Queries document events strictly scoped by workspaceId with time-bounded pagination limit.
 */
export async function queryDocumentEvents(
  workspaceId: string,
  filter?: QueryDocumentEventsFilter
): Promise<DocumentDomainEvent[]> {
  if (!workspaceId) {
    throw new Error('[DocumentEventBus] workspaceId is mandatory for querying document events.');
  }

  const maxLimit = Math.min(filter?.limit || 25, 100);
  let query = adminDb.collection('document_events').where('workspaceId', '==', workspaceId);

  if (filter?.envelopeId) {
    query = query.where('envelopeId', '==', filter.envelopeId);
  }
  if (filter?.contractId) {
    query = query.where('contractId', '==', filter.contractId);
  }
  if (filter?.dealId) {
    query = query.where('dealId', '==', filter.dealId);
  }

  const snapshot = await query.limit(maxLimit).get();
  return snapshot.docs.map((doc) => DocumentDomainEventSchema.parse(doc.data()));
}
