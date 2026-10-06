/**
 * @fileOverview Single-use resumption tokens across instances (Phase 11 M0 · T5.4, finding F8; Rule 20).
 *
 * Before: replay protection was a `Set` inside one process, so the same token could resume a step on a
 * second instance (or after a restart). Now consumption is a transactional create of
 * `workflow_resumption_tokens/{sha256(token)}`: the first caller wins, every later caller (any
 * instance) is refused. Only the hash is stored, never the token. `expiresAt` lets a TTL policy
 * remove old entries.
 *
 * Memory mode (tests, local) keeps a per-process set via the platform storage switch.
 *
 * Tests: src/platform/__tests__/workflows/approval-resume.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { selectPlatformStore } from '@/platform/storage/storage-mode';

export const RESUMPTION_TOKENS = 'workflow_resumption_tokens';

export interface ResumptionTokenLedger {
  /** Fast early check (read-only); `consume` is the atomic guard. */
  isConsumed(token: string): Promise<boolean>;
  /** True when this call consumed the token; false when it was already used. */
  consume(token: string, meta: { workflowId: string; stepId: string; expiresAtMs: number; nowMs: number }): Promise<boolean>;
}

export const tokenKey = (token: string): string => createHash('sha256').update(token).digest('hex');

export function createFirestoreTokenLedger(db: () => Promise<Firestore> | Firestore): ResumptionTokenLedger {
  return {
    async isConsumed(token) {
      const firestore = await db();
      return (await firestore.collection(RESUMPTION_TOKENS).doc(tokenKey(token)).get()).exists;
    },
    async consume(token, meta) {
      const firestore = await db();
      const ref = firestore.collection(RESUMPTION_TOKENS).doc(tokenKey(token));
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, {
          workflowId: meta.workflowId,
          stepId: meta.stepId,
          consumedAt: new Date(meta.nowMs).toISOString(),
          expiresAt: new Date(meta.expiresAtMs),
        });
        return true;
      });
    },
  };
}

export function createMemoryTokenLedger(): ResumptionTokenLedger {
  const used = new Set<string>();
  return {
    async isConsumed(token) {
      return used.has(tokenKey(token));
    },
    async consume(token) {
      const key = tokenKey(token);
      if (used.has(key)) return false;
      used.add(key);
      return true;
    },
  };
}

export function defaultTokenLedger(): ResumptionTokenLedger {
  return selectPlatformStore<ResumptionTokenLedger>(
    createMemoryTokenLedger,
    () => createFirestoreTokenLedger(async () => (await import('@/lib/firebase-admin')).adminDb)
  );
}
