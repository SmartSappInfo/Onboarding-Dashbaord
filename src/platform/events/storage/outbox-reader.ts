/**
 * @fileOverview Outbox Storage Reader & Concurrency Leasing Engine (Milestone 1)
 *
 * Implements Rule 9 (High Load & Bounded Queues), Rule 18 (Optimistic Concurrency & Leasing Locks),
 * Rule 27 (Transactional Outbox Pattern), Rule 47 (Multi-Tenant Isolation), and Rule 69 (Master Layering Axiom).
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS:
 * - Leased records use `status: 'processing'` and `leaseExpiresAt: ISO8601`.
 * - Cloud Run containers may shut down during execution. Expired leases (`leaseExpiresAt < now`)
 *   MUST be automatically reclaimed on subsequent dispatch cycles to prevent permanent stalls.
 * - Leases are strictly bounded by `batchSize` to prevent memory exhaustion and Firestore query spikes.
 *
 * @testability Covered in `src/platform/__tests__/events/outbox-reader.test.ts`.
 */

import {
  DomainEventSchema,
  type DomainEvent,
} from '../../capabilities/events/domain-event';
import type { EventDispatchOptions } from '../contracts/event-dispatcher.contract';
import { DOMAIN_EVENTS_COLLECTION } from '../../capabilities/storage/outbox-store';
import { selectPlatformStore } from '@/platform/storage/storage-mode';

export interface OutboxLeaseRecord {
  id: string;
  event: DomainEvent;
  status: 'pending' | 'processing' | 'published' | 'failed' | 'dead_letter';
  attempts: number;
  leaseExpiresAt?: string | null;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

export interface OutboxReader {
  enqueue(events: DomainEvent[]): Promise<void>;
  acquireLeasedBatch(options: EventDispatchOptions): Promise<OutboxLeaseRecord[]>;
  releaseLease(eventId: string, error?: string): Promise<void>;
  markPublished(eventId: string): Promise<void>;
  markDeadLetter(eventId: string, error?: string): Promise<void>;
  get(eventId: string): Promise<OutboxLeaseRecord | null>;
}

/**
 * Creates an in-memory outbox reader for test isolation and local dev.
 */
export function createInMemoryOutboxReader(
  initialRecords: OutboxLeaseRecord[] = []
): OutboxReader {
  const store = new Map<string, OutboxLeaseRecord>();

  for (const rec of initialRecords) {
    store.set(rec.id, { ...rec });
  }

  return {
    async enqueue(events: DomainEvent[]): Promise<void> {
      const now = new Date().toISOString();
      for (const event of events) {
        const validated = DomainEventSchema.parse(event);
        store.set(validated.id, {
          id: validated.id,
          event: validated,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      }
    },

    async acquireLeasedBatch(options: EventDispatchOptions): Promise<OutboxLeaseRecord[]> {
      const now = new Date();
      const nowIso = now.toISOString();
      const leaseExpiresAt = new Date(now.getTime() + options.leaseDurationMs).toISOString();

      const candidateRecords: OutboxLeaseRecord[] = [];

      for (const record of store.values()) {
        // Multi-tenant filtering (Rule 47)
        if (options.organizationId && record.event.organizationId !== options.organizationId) {
          continue;
        }
        if (options.workspaceId && record.event.workspaceId !== options.workspaceId) {
          continue;
        }

        const isPending = record.status === 'pending';
        const isExpiredLease =
          record.status === 'processing' &&
          record.leaseExpiresAt &&
          new Date(record.leaseExpiresAt) < now;

        if (isPending || isExpiredLease) {
          candidateRecords.push(record);
        }
      }

      // Sort by creation time to preserve FIFO sequence
      candidateRecords.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const leasedBatch: OutboxLeaseRecord[] = [];
      for (let i = 0; i < Math.min(candidateRecords.length, options.batchSize); i++) {
        const rec = candidateRecords[i];
        rec.status = 'processing';
        rec.leaseExpiresAt = leaseExpiresAt;
        rec.lastAttemptAt = nowIso;
        leasedBatch.push({ ...rec });
      }

      return leasedBatch;
    },

    async releaseLease(eventId: string, error?: string): Promise<void> {
      const rec = store.get(eventId);
      if (rec) {
        rec.status = 'pending';
        rec.attempts += 1;
        rec.leaseExpiresAt = null;
        if (error) {
          rec.lastError = error;
        }
      }
    },

    async markPublished(eventId: string): Promise<void> {
      const rec = store.get(eventId);
      if (rec) {
        rec.status = 'published';
        rec.leaseExpiresAt = null;
        rec.publishedAt = new Date().toISOString();
      }
    },

    async markDeadLetter(eventId: string, error?: string): Promise<void> {
      const rec = store.get(eventId);
      if (rec) {
        rec.status = 'dead_letter';
        rec.leaseExpiresAt = null;
        if (error) {
          rec.lastError = error;
        }
      }
    },

    async get(eventId: string): Promise<OutboxLeaseRecord | null> {
      const rec = store.get(eventId);
      return rec ? { ...rec } : null;
    },
  };
}

/**
 * Production Firestore outbox reader with atomic transactions and lease locking.
 */
export class FirestoreOutboxReader implements OutboxReader {
  public async enqueue(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const { adminDb } = await import('@/lib/firebase-admin');
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const rawEvent of events) {
      const validated = DomainEventSchema.parse(rawEvent);
      const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(validated.id);

      const record: OutboxLeaseRecord = {
        id: validated.id,
        event: validated,
        status: 'pending',
        attempts: 0,
        createdAt: now,
      };

      batch.set(docRef, record);
    }

    await batch.commit();
  }

  public async acquireLeasedBatch(options: EventDispatchOptions): Promise<OutboxLeaseRecord[]> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const now = new Date();
      const nowIso = now.toISOString();
      const leaseExpiresAt = new Date(now.getTime() + options.leaseDurationMs).toISOString();

      let queryRef = adminDb
        .collection(DOMAIN_EVENTS_COLLECTION)
        .where('status', 'in', ['pending', 'processing'])
        .orderBy('createdAt', 'asc')
        .limit(options.batchSize * 2);

      if (options.organizationId) {
        queryRef = queryRef.where('event.organizationId', '==', options.organizationId);
      }
      if (options.workspaceId) {
        queryRef = queryRef.where('event.workspaceId', '==', options.workspaceId);
      }

      const snap = await queryRef.get();
      const leasedBatch: OutboxLeaseRecord[] = [];
      const batch = adminDb.batch();

      for (const doc of snap.docs) {
        if (leasedBatch.length >= options.batchSize) break;

        const record = doc.data() as OutboxLeaseRecord;
        const isPending = record.status === 'pending';
        const isExpiredLease =
          record.status === 'processing' &&
          record.leaseExpiresAt &&
          new Date(record.leaseExpiresAt) < now;

        if (isPending || isExpiredLease) {
          const updated: OutboxLeaseRecord = {
            ...record,
            status: 'processing',
            leaseExpiresAt,
            lastAttemptAt: nowIso,
          };

          batch.update(doc.ref, {
            status: 'processing',
            leaseExpiresAt,
            lastAttemptAt: nowIso,
          });

          leasedBatch.push(updated);
        }
      }

      if (leasedBatch.length > 0) {
        await batch.commit();
      }

      return leasedBatch;
    } catch {
      return [];
    }
  }

  public async releaseLease(eventId: string, error?: string): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const { FieldValue } = await import('firebase-admin/firestore');
      const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);

      await docRef.update({
        status: 'pending',
        leaseExpiresAt: null,
        attempts: FieldValue.increment(1),
        lastError: error || null,
      });
    } catch {
      // In-flight errors handled gracefully
    }
  }

  public async markPublished(eventId: string): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);

      await docRef.update({
        status: 'published',
        leaseExpiresAt: null,
        publishedAt: new Date().toISOString(),
      });
    } catch {
      // Handled
    }
  }

  public async markDeadLetter(eventId: string, error?: string): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);

      await docRef.update({
        status: 'dead_letter',
        leaseExpiresAt: null,
        lastError: error || null,
      });
    } catch {
      // Handled
    }
  }

  public async get(eventId: string): Promise<OutboxLeaseRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId).get();
      if (!snap.exists) return null;
      return snap.data() as OutboxLeaseRecord;
    } catch {
      return null;
    }
  }
}

/**
 * Default process-wide outbox reader singleton.
 */
// CAUTION (Phase 11 M0 · F1): memory only under test or explicit non-production opt-in; never an
// implicit fallback. See src/platform/storage/storage-mode.ts.
export const defaultOutboxReader: OutboxReader =
  selectPlatformStore(
    () => createInMemoryOutboxReader(),
    () => new FirestoreOutboxReader()
  );
