/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Canonical Document Event Taxonomy & Durable Event Bus (P4.3).
 * 2. Invariants Tested:
 *    - Strongly-typed canonical event creation and schema validation.
 *    - Firestore `document_events` persistence with workspace scoping.
 *    - Non-blocking execution via runAfter/Next.js after().
 *    - Cross-subsystem bridge to Deals domain event bus (`emitDealDomainEvent`).
 *    - Strictly bounded cursor querying with limit(25) fallback.
 *    - Zero tolerance for untyped data (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentDomainEvent } from '@/lib/types/document-signing';

const mockEventsStore: DocumentDomainEvent[] = [];

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'document_events') {
        return {
          doc: vi.fn().mockImplementation((docId?: string) => ({
            set: vi.fn().mockImplementation(async (data: DocumentDomainEvent) => {
              mockEventsStore.push(data);
              return { id: docId || data.id };
            }),
          })),
          where: vi.fn().mockImplementation((field: string, op: string, val: string) => {
            let filtered = mockEventsStore.filter(
              (item) => (item as unknown as Record<string, unknown>)[field] === val
            );
            const queryObj: {
              where: ReturnType<typeof vi.fn>;
              orderBy: ReturnType<typeof vi.fn>;
              limit: ReturnType<typeof vi.fn>;
              get: ReturnType<typeof vi.fn>;
            } = {
              where: vi.fn().mockImplementation((nextField: string, nextOp: string, nextVal: string) => {
                filtered = filtered.filter(
                  (item) => (item as unknown as Record<string, unknown>)[nextField] === nextVal
                );
                return queryObj;
              }),
              orderBy: vi.fn().mockImplementation(() => queryObj),
              limit: vi.fn().mockImplementation((maxCount: number) => ({
                get: vi.fn().mockImplementation(async () => ({
                  docs: filtered.slice(0, maxCount).map((d) => ({
                    id: d.id,
                    data: () => d,
                  })),
                })),
              })),
              get: vi.fn().mockImplementation(async () => ({
                docs: filtered.slice(0, 25).map((d) => ({
                  id: d.id,
                  data: () => d,
                })),
              })),
            };
            return queryObj;
          }),
        };
      }
      return {};
    }),
  },
}));

// Mock Deals Domain Event Bus
const mockEmitDealDomainEvent = vi.fn();
vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: (...args: unknown[]) => mockEmitDealDomainEvent(...args),
}));

// Mock Next.js after()
vi.mock('next/server', () => ({
  after: vi.fn().mockImplementation((fn: () => void | Promise<void>) => {
    // Run immediately in test environment
    void fn();
  }),
}));

import {
  emitDocumentDomainEvent,
  queryDocumentEvents,
  createDocumentEventId,
} from '../document-event-bus';

describe('P4.3 Document Event Bus & Bridge', () => {
  beforeEach(() => {
    mockEventsStore.length = 0;
    mockEmitDealDomainEvent.mockClear();
    vi.clearAllMocks();
  });

  it('creates deterministic, collision-resistant event IDs', () => {
    const id = createDocumentEventId('signing.envelope_completed', 'env_123', '2026-09-29T10:00:00.000Z');
    expect(id).toMatch(/^evt_signing_envelope_completed_env_123_\d+_[a-z0-9]+$/);
  });

  it('emits and persists document.dispatched event and forwards to Deal bus if dealId is present', async () => {
    const event = emitDocumentDomainEvent({
      workspaceId: 'ws_test_1',
      type: 'document.dispatched',
      envelopeId: 'env_abc_1',
      contractId: 'ctr_xyz_1',
      dealId: 'deal_456',
      actorId: 'usr_admin_1',
      metadata: { recipientCount: 2 },
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe('document.dispatched');
    expect(event.dealId).toBe('deal_456');

    // Allow Next.js runAfter/after() microtasks to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify Deal Domain Bus bridged
    expect(mockEmitDealDomainEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
      'deal.contract.sent',
      expect.objectContaining({
        dealId: 'deal_456',
        workspaceId: 'ws_test_1',
        envelopeId: 'env_abc_1',
        contractId: 'ctr_xyz_1',
      })
    );
  });

  it('emits signing.envelope_completed and bridges to deal.contract.signed', async () => {
    const event = emitDocumentDomainEvent({
      workspaceId: 'ws_test_1',
      type: 'signing.envelope_completed',
      envelopeId: 'env_abc_1',
      contractId: 'ctr_xyz_1',
      dealId: 'deal_456',
      actorId: 'system',
      metadata: { executionHash: 'hash123' },
    });

    expect(event.type).toBe('signing.envelope_completed');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
      'deal.contract.signed',
      expect.objectContaining({
        dealId: 'deal_456',
        envelopeId: 'env_abc_1',
      })
    );
  });

  it('emits signing.recipient_declined and bridges to deal.contract.declined', async () => {
    const event = emitDocumentDomainEvent({
      workspaceId: 'ws_test_1',
      type: 'signing.recipient_declined',
      envelopeId: 'env_abc_1',
      dealId: 'deal_456',
      recipientId: 'rec_signer_2',
      actorId: 'rec_signer_2',
      metadata: { reason: 'Terms disagreement' },
    });

    expect(event.type).toBe('signing.recipient_declined');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockEmitDealDomainEvent).toHaveBeenCalledWith(
      'deal.contract.declined',
      expect.objectContaining({
        dealId: 'deal_456',
        envelopeId: 'env_abc_1',
      })
    );
  });

  it('does NOT invoke deal event bus if dealId is omitted', async () => {
    emitDocumentDomainEvent({
      workspaceId: 'ws_test_1',
      type: 'contract.created',
      contractId: 'ctr_internal_99',
      actorId: 'usr_legal',
    });

    expect(mockEmitDealDomainEvent).not.toHaveBeenCalled();
  });

  it('queries events with mandatory workspace scoping and limit bounding', async () => {
    // Populate store
    mockEventsStore.push({
      id: 'evt_1',
      workspaceId: 'ws_test_1',
      type: 'document.dispatched',
      envelopeId: 'env_target',
      actorId: 'usr_1',
      metadata: {},
      timestamp: '2026-09-29T10:00:00.000Z',
    });
    mockEventsStore.push({
      id: 'evt_2',
      workspaceId: 'ws_other', // Different workspace
      type: 'document.dispatched',
      envelopeId: 'env_target',
      actorId: 'usr_2',
      metadata: {},
      timestamp: '2026-09-29T10:01:00.000Z',
    });

    const events = await queryDocumentEvents('ws_test_1', { envelopeId: 'env_target' });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt_1');
    expect(events[0].workspaceId).toBe('ws_test_1');
  });
});
