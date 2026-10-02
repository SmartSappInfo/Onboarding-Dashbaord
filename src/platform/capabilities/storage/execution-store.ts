/**
 * @fileOverview Durable Execution & Idempotency Store (PR-7 / Workstream 1.4)
 *
 * Implements Rule 18 (Concurrency Control), Rule 19 (Idempotency Requirements),
 * and Rule 20 (Replay Protection).
 *
 * Persists execution leases and cached replay outputs in Firestore collection `/capability_executions`.
 * Supports distributed atomic lease locking via Firestore transactions and 24-hour TTL expiration.
 * Provides an in-memory store for unit testing and local development.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type {
  IdempotencyStore,
  StoredIdempotencyRecord,
} from '../execution/pipeline/10-check-idempotency';

/**
 * Builds a deterministic, namespace-isolated execution key across multi-tenant boundaries.
 */
export function buildExecutionKey(
  organizationId: string,
  workspaceId: string,
  capabilityId: string,
  idempotencyKey: string
): string {
  return `${organizationId}:${workspaceId}:${capabilityId}:${idempotencyKey}`;
}

export interface ExtendedIdempotencyStore extends IdempotencyStore {
  complete(key: string, result: unknown): Promise<void>;
  fail(key: string, error?: unknown): Promise<void>;
}

/**
 * Creates an in-memory implementation of the IdempotencyStore.
 * Safe for unit testing, test isolation, and local development.
 */
export function createInMemoryIdempotencyStore(): ExtendedIdempotencyStore {
  const store = new Map<string, StoredIdempotencyRecord>();

  return {
    async get(key: string): Promise<StoredIdempotencyRecord | null> {
      return store.get(key) ?? null;
    },

    async claim(
      key: string,
      options: { leaseMs: number; nowMs: number }
    ): Promise<{ claimed: boolean; leaseExpiresAt: string }> {
      const existing = store.get(key);
      const leaseExpiresAt = new Date(options.nowMs + options.leaseMs).toISOString();

      if (existing) {
        if (existing.status === 'completed') {
          return { claimed: false, leaseExpiresAt: existing.leaseExpiresAt || leaseExpiresAt };
        }

        if (existing.status === 'running') {
          const expiresMs = existing.leaseExpiresAt ? Date.parse(existing.leaseExpiresAt) : Number.NaN;
          if (!Number.isNaN(expiresMs) && expiresMs > options.nowMs) {
            return { claimed: false, leaseExpiresAt: existing.leaseExpiresAt || leaseExpiresAt };
          }
        }
      }

      store.set(key, {
        status: 'running',
        leaseExpiresAt,
      });

      return { claimed: true, leaseExpiresAt };
    },

    async complete(key: string, result: unknown): Promise<void> {
      const existing = store.get(key);
      store.set(key, {
        ...existing,
        status: 'completed',
        result,
      });
    },

    async fail(key: string): Promise<void> {
      const existing = store.get(key);
      if (existing) {
        store.set(key, {
          ...existing,
          status: 'failed',
        });
      }
    },
  };
}

/**
 * Firestore-backed durable IdempotencyStore using collection `/capability_executions`.
 */
export class FirestoreIdempotencyStore implements ExtendedIdempotencyStore {
  private static readonly COLLECTION = 'capability_executions';
  private readonly ttlHours: number = 24;

  public async get(key: string): Promise<StoredIdempotencyRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const doc = await adminDb.collection(FirestoreIdempotencyStore.COLLECTION).doc(key).get();
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) return null;

      return {
        status: data.status as 'running' | 'completed' | 'failed',
        leaseExpiresAt: data.leaseExpiresAt as string | undefined,
        result: data.result,
      };
    } catch {
      return null;
    }
  }

  public async claim(
    key: string,
    options: { leaseMs: number; nowMs: number }
  ): Promise<{ claimed: boolean; leaseExpiresAt: string }> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const docRef = adminDb.collection(FirestoreIdempotencyStore.COLLECTION).doc(key);
    const leaseExpiresAt = new Date(options.nowMs + options.leaseMs).toISOString();

    const expDate = new Date(options.nowMs);
    expDate.setHours(expDate.getHours() + this.ttlHours);
    const expiresAt = expDate.toISOString();

    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (snap.exists) {
        const data = snap.data();
        if (data?.status === 'completed') {
          return { claimed: false, leaseExpiresAt: (data.leaseExpiresAt as string) || leaseExpiresAt };
        }

        if (data?.status === 'running') {
          const currentExpiry = data.leaseExpiresAt ? Date.parse(data.leaseExpiresAt as string) : Number.NaN;
          if (!Number.isNaN(currentExpiry) && currentExpiry > options.nowMs) {
            return { claimed: false, leaseExpiresAt: data.leaseExpiresAt as string };
          }
        }

        // Lease expired or failed, re-claim in-place
        transaction.update(docRef, {
          status: 'running',
          leaseExpiresAt,
          updatedAt: new Date(options.nowMs).toISOString(),
          expiresAt,
        });

        return { claimed: true, leaseExpiresAt };
      }

      // New key
      transaction.set(docRef, {
        key,
        status: 'running',
        leaseExpiresAt,
        createdAt: new Date(options.nowMs).toISOString(),
        expiresAt,
      });

      return { claimed: true, leaseExpiresAt };
    });
  }

  public async complete(key: string, result: unknown): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(FirestoreIdempotencyStore.COLLECTION).doc(key);
      await docRef.update({
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort completion update
    }
  }

  public async fail(key: string, error?: unknown): Promise<void> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(FirestoreIdempotencyStore.COLLECTION).doc(key);
      const errorMessage = error instanceof Error ? error.message : String(error || 'Execution failed');
      await docRef.update({
        status: 'failed',
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort failure update
    }
  }
}

/**
 * Default process-wide idempotency store.
 * Automatically chooses in-memory when running under Vitest/Node tests,
 * and FirestoreIdempotencyStore in production runtime.
 */
export const defaultIdempotencyStore: ExtendedIdempotencyStore =
  process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID
    ? createInMemoryIdempotencyStore()
    : new FirestoreIdempotencyStore();
