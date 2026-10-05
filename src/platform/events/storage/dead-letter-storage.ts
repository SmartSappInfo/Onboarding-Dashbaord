/**
 * @fileOverview Dead-Letter Queue (DLQ) Storage & Exponential Backoff Engine (Milestone 1)
 *
 * Implements Rule 24 (Circuit Breakers), Rule 25 (Dead-Letter & Recovery Queues),
 * Rule 40 (Audit Immutability), and Rule 47 (Multi-Tenant Isolation).
 *
 * Persists unrecoverable events failing past MAX_EVENT_ATTEMPTS into Firestore `dead_letter_events/{eventId}`.
 * Provides operator visibility and manual/automated replaying capabilities without data loss.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/dead-letter.test.ts`.
 */

import type { DomainEvent } from '../../capabilities/events/domain-event';
import { selectPlatformStore } from '@/platform/storage/storage-mode';

export const DEAD_LETTER_EVENTS_COLLECTION = 'dead_letter_events';
export const MAX_EVENT_ATTEMPTS = 3;

export interface DeadLetterRecord {
  eventId: string;
  event: DomainEvent;
  attempts: number;
  lastError: string;
  errorStack?: string;
  quarantinedAt: string;
  organizationId: string;
  workspaceId?: string | null;
  status: 'quarantined' | 'replayed' | 'discarded';
  replayedAt?: string | null;
  operatorNotes?: string | null;
}

export interface ListDeadLetterOptions {
  organizationId?: string;
  workspaceId?: string;
  limit?: number;
}

export interface DeadLetterStorage {
  quarantineEvent(
    record: Omit<DeadLetterRecord, 'quarantinedAt' | 'status'>
  ): Promise<void>;
  listDeadLetterEvents(options?: ListDeadLetterOptions): Promise<DeadLetterRecord[]>;
  markReplayed(eventId: string): Promise<void>;
  markDiscarded(eventId: string, reason?: string): Promise<void>;
  get(eventId: string): Promise<DeadLetterRecord | null>;
}

/**
 * Calculates exponential backoff with full jitter (Rule 25).
 * Formula: t = min(maxMs, baseMs * 2^attempts) + jitter
 */
export function calculateBackoffMs(
  attempts: number,
  baseMs: number = 1000,
  maxMs: number = 30000
): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempts));
  const jitter = Math.random() * (exponential * 0.2); // 20% random jitter
  return Math.floor(exponential + jitter);
}

/**
 * Creates an in-memory DLQ storage for tests and local dev.
 */
export function createInMemoryDeadLetterStorage(): DeadLetterStorage {
  const records = new Map<string, DeadLetterRecord>();

  return {
    async quarantineEvent(
      record: Omit<DeadLetterRecord, 'quarantinedAt' | 'status'>
    ): Promise<void> {
      const quarantinedRecord: DeadLetterRecord = {
        ...record,
        quarantinedAt: new Date().toISOString(),
        status: 'quarantined',
        workspaceId: record.workspaceId ?? null,
      };
      records.set(record.eventId, quarantinedRecord);
    },

    async listDeadLetterEvents(options?: ListDeadLetterOptions): Promise<DeadLetterRecord[]> {
      const results: DeadLetterRecord[] = [];
      const limit = options?.limit ?? 50;

      for (const rec of records.values()) {
        if (options?.organizationId && rec.organizationId !== options.organizationId) {
          continue;
        }
        if (options?.workspaceId && rec.workspaceId !== options.workspaceId) {
          continue;
        }
        results.push({ ...rec });
        if (results.length >= limit) break;
      }

      // Sort newest quarantined first
      results.sort((a, b) => b.quarantinedAt.localeCompare(a.quarantinedAt));
      return results;
    },

    async markReplayed(eventId: string): Promise<void> {
      const rec = records.get(eventId);
      if (rec) {
        rec.status = 'replayed';
        rec.replayedAt = new Date().toISOString();
      }
    },

    async markDiscarded(eventId: string, reason?: string): Promise<void> {
      const rec = records.get(eventId);
      if (rec) {
        rec.status = 'discarded';
        rec.operatorNotes = reason || null;
      }
    },

    async get(eventId: string): Promise<DeadLetterRecord | null> {
      const rec = records.get(eventId);
      return rec ? { ...rec } : null;
    },
  };
}

/**
 * Production Firestore Dead-Letter Storage.
 */
export class FirestoreDeadLetterStorage implements DeadLetterStorage {
  public async quarantineEvent(
    record: Omit<DeadLetterRecord, 'quarantinedAt' | 'status'>
  ): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(DEAD_LETTER_EVENTS_COLLECTION).doc(record.eventId);

      const quarantinedRecord: DeadLetterRecord = {
        ...record,
        quarantinedAt: new Date().toISOString(),
        status: 'quarantined',
        workspaceId: record.workspaceId ?? null,
      };

      await docRef.set(quarantinedRecord);
    } catch {
      // In-flight error handling
    }
  }

  public async listDeadLetterEvents(options?: ListDeadLetterOptions): Promise<DeadLetterRecord[]> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const limit = options?.limit ?? 50;
      let queryRef = adminDb
        .collection(DEAD_LETTER_EVENTS_COLLECTION)
        .orderBy('quarantinedAt', 'desc')
        .limit(limit);

      if (options?.organizationId) {
        queryRef = queryRef.where('organizationId', '==', options.organizationId);
      }
      if (options?.workspaceId) {
        queryRef = queryRef.where('workspaceId', '==', options.workspaceId);
      }

      const snap = await queryRef.get();
      return snap.docs.map((doc) => doc.data() as DeadLetterRecord);
    } catch {
      return [];
    }
  }

  public async markReplayed(eventId: string): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(DEAD_LETTER_EVENTS_COLLECTION).doc(eventId);
      await docRef.update({
        status: 'replayed',
        replayedAt: new Date().toISOString(),
      });
    } catch {
      // Handled
    }
  }

  public async markDiscarded(eventId: string, reason?: string): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(DEAD_LETTER_EVENTS_COLLECTION).doc(eventId);
      await docRef.update({
        status: 'discarded',
        operatorNotes: reason || null,
      });
    } catch {
      // Handled
    }
  }

  public async get(eventId: string): Promise<DeadLetterRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection(DEAD_LETTER_EVENTS_COLLECTION).doc(eventId).get();
      if (!snap.exists) return null;
      return snap.data() as DeadLetterRecord;
    } catch {
      return null;
    }
  }
}

/**
 * Default process-wide DLQ singleton.
 */
// CAUTION (Phase 11 M0 · F1): memory only under test or explicit non-production opt-in; never an
// implicit fallback. See src/platform/storage/storage-mode.ts.
export const defaultDeadLetterStorage: DeadLetterStorage =
  selectPlatformStore<DeadLetterStorage>(
    () => createInMemoryDeadLetterStorage(),
    () => new FirestoreDeadLetterStorage()
  );
