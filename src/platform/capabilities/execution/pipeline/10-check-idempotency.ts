/**
 * @fileOverview Pipeline Step 10: Check Idempotency & Replay Protection (Phase 1 / PR-4)
 *
 * Implements Rule 19 (Mandatory Idempotency Definition), Rule 20 (Replay Protection),
 * PRD §73, and Tools §4.
 *
 * - Enforces `policies.requiresIdempotencyKey`.
 * - Detects duplicate requests in progress and rejects with `DUPLICATE_IN_PROGRESS` (`stateChanged: 'no'`).
 * - Returns stored cached results for already-completed idempotent executions.
 * - Binds a key to the input it was first used with (M2 review R5): a completed or running record
 *   with a different input hash → `IDEMPOTENCY_KEY_REUSED` (nothing replayed, nothing run). After a
 *   failed attempt the key may be re-claimed with corrected input. Records without a hash (written
 *   before this change, 24 h TTL) are accepted.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export interface StoredIdempotencyRecord<TOutput = unknown> {
  status: 'running' | 'completed' | 'failed';
  leaseExpiresAt?: string;
  result?: TOutput;
  /** sha256 of the validated input the key was claimed with. */
  inputHash?: string;
}

export interface IdempotencyStore {
  get(key: string): Promise<StoredIdempotencyRecord | null>;
  claim(key: string, options: { leaseMs: number; nowMs: number; inputHash?: string }): Promise<{ claimed: boolean; leaseExpiresAt: string }>;
}

export interface IdempotencyCheckOutcome<TOutput = unknown> {
  isReplay: boolean;
  cachedResult?: TOutput;
}

export async function step10CheckIdempotency(
  capability: AnyCapabilityDefinition,
  idempotencyKey: string | undefined,
  store?: IdempotencyStore,
  nowMs: number = Date.now(),
  inputHash?: string
): Promise<IdempotencyCheckOutcome> {
  if (capability.policies.requiresIdempotencyKey && !idempotencyKey) {
    throw CapabilityError.validation(`Capability '${capability.id}' requires an idempotency key.`);
  }

  if (!idempotencyKey || !store) {
    return { isReplay: false };
  }

  const existing = await store.get(idempotencyKey);
  if (existing) {
    const differentInput = Boolean(inputHash && existing.inputHash && existing.inputHash !== inputHash);
    if (differentInput && (existing.status === 'completed' || existing.status === 'running')) {
      throw CapabilityError.idempotencyKeyReused();
    }
    if (existing.status === 'completed' && existing.result !== undefined) {
      return { isReplay: true, cachedResult: existing.result };
    }

    if (existing.status === 'running') {
      const leaseExpiresMs = existing.leaseExpiresAt ? Date.parse(existing.leaseExpiresAt) : Number.NaN;
      if (!Number.isNaN(leaseExpiresMs) && leaseExpiresMs > nowMs) {
        throw CapabilityError.duplicateInProgress(existing.leaseExpiresAt);
      }
      // Lease expired, fall through to re-claim
    }
  }

  // Claim lease
  const leaseMs = capability.execution.maxDurationMs + 10_000;
  const claim = await store.claim(idempotencyKey, { leaseMs, nowMs, ...(inputHash ? { inputHash } : {}) });
  if (!claim.claimed) {
    throw CapabilityError.duplicateInProgress(claim.leaseExpiresAt);
  }

  return { isReplay: false };
}
