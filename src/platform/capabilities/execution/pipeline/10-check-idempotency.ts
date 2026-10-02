/**
 * @fileOverview Pipeline Step 10: Check Idempotency & Replay Protection (Phase 1 / PR-4)
 *
 * Implements Rule 19 (Mandatory Idempotency Definition), Rule 20 (Replay Protection),
 * PRD §73, and Tools §4.
 *
 * - Enforces `policies.requiresIdempotencyKey`.
 * - Detects duplicate requests in progress and rejects with `DUPLICATE_IN_PROGRESS` (`stateChanged: 'no'`).
 * - Returns stored cached results for already-completed idempotent executions.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export interface StoredIdempotencyRecord<TOutput = unknown> {
  status: 'running' | 'completed' | 'failed';
  leaseExpiresAt?: string;
  result?: TOutput;
}

export interface IdempotencyStore {
  get(key: string): Promise<StoredIdempotencyRecord | null>;
  claim(key: string, options: { leaseMs: number; nowMs: number }): Promise<{ claimed: boolean; leaseExpiresAt: string }>;
}

export interface IdempotencyCheckOutcome<TOutput = unknown> {
  isReplay: boolean;
  cachedResult?: TOutput;
}

export async function step10CheckIdempotency(
  capability: AnyCapabilityDefinition,
  idempotencyKey: string | undefined,
  store?: IdempotencyStore,
  nowMs: number = Date.now()
): Promise<IdempotencyCheckOutcome> {
  if (capability.policies.requiresIdempotencyKey && !idempotencyKey) {
    throw CapabilityError.validation(`Capability '${capability.id}' requires an idempotency key.`);
  }

  if (!idempotencyKey || !store) {
    return { isReplay: false };
  }

  const existing = await store.get(idempotencyKey);
  if (existing) {
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
  const claim = await store.claim(idempotencyKey, { leaseMs, nowMs });
  if (!claim.claimed) {
    throw CapabilityError.duplicateInProgress(claim.leaseExpiresAt);
  }

  return { isReplay: false };
}
