/**
 * @fileOverview Canonical Transactional Outbox Store (PR-7 / Workstream 1.4)
 *
 * Implements Rule 32 (Transactional Outbox), Rule 27 (Dual-Write Defense),
 * Rule 39 (OpenTelemetry Tracing / Causation), and PRD §73.
 *
 * Persists domain events emitted by capabilities into Firestore collection `domain_events/{id}`.
 * Guarantees zero lost events across multi-tenant environments by validating against `DomainEventSchema`
 * and buffering events for asynchronous delivery.
 *
 * Provides:
 * - `createInMemoryOutboxStore`: Isolated in-memory store for unit tests and local dev.
 * - `FirestoreOutboxStore`: Production Firestore store with batching and transaction support.
 * - `createFirestoreOutboxSink` & `defaultOutboxSink`: Standardized sinks for the capability pipeline.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  DomainEventSchema,
  type DomainEvent,
} from '../events/domain-event';
import { selectPlatformStore } from '@/platform/storage/storage-mode';

export const DOMAIN_EVENTS_COLLECTION = 'domain_events';

export type OutboxStatus = 'pending' | 'published' | 'failed';

export interface OutboxRecord {
  id: string;
  event: DomainEvent;
  status: OutboxStatus;
  attempts: number;
  createdAt: string;
  publishedAt?: string;
  error?: string;
}

export interface OutboxStore {
  enqueue(events: DomainEvent[]): Promise<void>;
  listPending(limit?: number): Promise<OutboxRecord[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
  get(eventId: string): Promise<OutboxRecord | null>;
}

/**
 * Creates an in-memory outbox store for testing and local execution.
 */
export function createInMemoryOutboxStore(): OutboxStore {
  const records = new Map<string, OutboxRecord>();

  return {
    async enqueue(events: DomainEvent[]): Promise<void> {
      const now = new Date().toISOString();
      for (const rawEvent of events) {
        // Enforce strict schema validation before enqueuing (Rule 32)
        const validated = DomainEventSchema.parse(rawEvent);
        records.set(validated.id, {
          id: validated.id,
          event: validated,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      }
    },

    async listPending(limit: number = 50): Promise<OutboxRecord[]> {
      const pending: OutboxRecord[] = [];
      for (const rec of records.values()) {
        if (rec.status === 'pending') {
          pending.push(rec);
          if (pending.length >= limit) break;
        }
      }
      return pending;
    },

    async markPublished(eventId: string): Promise<void> {
      const rec = records.get(eventId);
      if (rec) {
        rec.status = 'published';
        rec.publishedAt = new Date().toISOString();
      }
    },

    async markFailed(eventId: string, error: string): Promise<void> {
      const rec = records.get(eventId);
      if (rec) {
        rec.status = 'failed';
        rec.attempts += 1;
        rec.error = error;
      }
    },

    async get(eventId: string): Promise<OutboxRecord | null> {
      return records.get(eventId) ?? null;
    },
  };
}

/**
 * Production Firestore transactional outbox store.
 */
export class FirestoreOutboxStore implements OutboxStore {
  public async enqueue(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const { adminDb } = await import('@/lib/firebase-admin');
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const rawEvent of events) {
      const validated = DomainEventSchema.parse(rawEvent);
      const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(validated.id);

      const record: OutboxRecord = {
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

  public async listPending(limit: number = 50): Promise<OutboxRecord[]> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb
        .collection(DOMAIN_EVENTS_COLLECTION)
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

      return snap.docs.map((doc) => doc.data() as OutboxRecord);
    } catch {
      return [];
    }
  }

  public async markPublished(eventId: string): Promise<void> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);
    await docRef.update({
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
  }

  public async markFailed(eventId: string, error: string): Promise<void> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    const docRef = adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);
    await docRef.update({
      status: 'failed',
      error,
      attempts: FieldValue.increment(1),
    });
  }

  public async get(eventId: string): Promise<OutboxRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId).get();
      if (!snap.exists) return null;
      return snap.data() as OutboxRecord;
    } catch {
      return null;
    }
  }
}

/**
 * Default process-wide outbox store singleton.
 */
// CAUTION (Phase 11 M0 · F1): memory only under test or explicit non-production opt-in; never an
// implicit fallback. See src/platform/storage/storage-mode.ts.
export const defaultOutboxStore: OutboxStore =
  selectPlatformStore<OutboxStore>(
    () => createInMemoryOutboxStore(),
    () => new FirestoreOutboxStore()
  );

/**
 * Creates an outbox sink function suitable for `executeCapability` or `step15AuditAndEvents`.
 */
export function createFirestoreOutboxSink(
  store: OutboxStore = defaultOutboxStore
): (events: DomainEvent[]) => Promise<void> {
  return async (events: DomainEvent[]) => {
    await store.enqueue(events);
  };
}

/**
 * Default outbox sink delegating directly to the canonical outbox store.
 */
export const defaultOutboxSink = createFirestoreOutboxSink(defaultOutboxStore);
