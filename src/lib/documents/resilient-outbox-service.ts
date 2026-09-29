/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Distributed Circuit Breaker & Resilient Outbox Persistence (Phase 6):
 * 1. Purpose & Distributed Cloud Run Synchronization (FM-P6-05 & RSK-02):
 *    Solves memory drift across autoscaled Cloud Run instances. Instead of
 *    tracking endpoint flapping and failure counts in process memory (which
 *    resets per container or fails to sync across parallel workers), this service
 *    backs circuit breaker telemetry in Firestore (`workspaces/{workspaceId}/system_circuit_breaker/{serviceKey}`).
 * 2. States:
 *    - `closed`: Normal operations. Requests allowed.
 *    - `open`: Failure threshold reached. Downstream endpoint is protected from traffic.
 *    - `half_open`: Cooldown elapsed. Allows canary test requests to probe recovery.
 * 3. Strict Tenant Isolation (Rule 5 & 8):
 *    All circuit breakers are strictly partitioned by `workspaceId`.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { CircuitBreakerStateSchema } from '@/lib/types/document-signing';

export type CircuitBreakerMode = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  workspaceId: string;
  serviceKey: string;
  state: CircuitBreakerMode;
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  nextAllowedAttemptAt: string | null;
  updatedAt: string;
}

export interface CircuitBreakerCheckResult {
  canExecute: boolean;
  state: CircuitBreakerMode;
  remainingCooldownMs: number;
}

/**
 * Checks the distributed circuit breaker state for a specific external service or webhook endpoint.
 */
export async function checkCircuitBreakerStatus(
  workspaceId: string,
  serviceKey: string
): Promise<CircuitBreakerCheckResult> {
  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/system_circuit_breaker`)
    .doc(serviceKey);

  const snap = await docRef.get();
  if (!snap || !snap.exists) {
    return {
      canExecute: true,
      state: 'closed',
      remainingCooldownMs: 0,
    };
  }

  const parseResult = CircuitBreakerStateSchema.safeParse(snap.data());
  if (!parseResult.success) {
    return {
      canExecute: true,
      state: 'closed',
      remainingCooldownMs: 0,
    };
  }

  const data = parseResult.data;
  const now = Date.now();

  if (data.state === 'closed') {
    return {
      canExecute: true,
      state: 'closed',
      remainingCooldownMs: 0,
    };
  }

  if (data.state === 'open') {
    if (data.nextAllowedAttemptAt) {
      const cooldownEnd = new Date(data.nextAllowedAttemptAt).getTime();
      if (now >= cooldownEnd) {
        // Cooldown period has elapsed, transition to half_open probe state
        return {
          canExecute: true,
          state: 'half_open',
          remainingCooldownMs: 0,
        };
      } else {
        return {
          canExecute: false,
          state: 'open',
          remainingCooldownMs: cooldownEnd - now,
        };
      }
    }
  }

  if (data.state === 'half_open') {
    return {
      canExecute: true,
      state: 'half_open',
      remainingCooldownMs: 0,
    };
  }

  return {
    canExecute: true,
    state: 'closed',
    remainingCooldownMs: 0,
  };
}

/**
 * Records a service failure in the distributed store, tripping the breaker if threshold is reached.
 */
export async function recordCircuitBreakerFailure(
  workspaceId: string,
  serviceKey: string,
  failureThreshold = 5,
  cooldownMs = 60000
): Promise<CircuitBreakerState> {
  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/system_circuit_breaker`)
    .doc(serviceKey);

  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Partial<CircuitBreakerState>) : {};

  const currentFailures = (existing.failureCount ?? 0) + 1;
  const now = new Date();
  const nowIso = now.toISOString();

  let nextState: CircuitBreakerMode = 'closed';
  let nextAllowed: string | null = null;

  if (currentFailures >= failureThreshold) {
    nextState = 'open';
    nextAllowed = new Date(now.getTime() + cooldownMs).toISOString();
  }

  const updatedState: CircuitBreakerState = {
    workspaceId,
    serviceKey,
    state: nextState,
    failureCount: currentFailures,
    successCount: existing.successCount ?? 0,
    lastFailureAt: nowIso,
    nextAllowedAttemptAt: nextAllowed,
    updatedAt: nowIso,
  };

  await docRef.set(updatedState);
  return updatedState;
}

/**
 * Records a successful execution, closing the circuit breaker and resetting failure counts.
 */
export async function recordCircuitBreakerSuccess(
  workspaceId: string,
  serviceKey: string
): Promise<CircuitBreakerState> {
  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/system_circuit_breaker`)
    .doc(serviceKey);

  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Partial<CircuitBreakerState>) : {};
  const nowIso = new Date().toISOString();

  const updatedState: CircuitBreakerState = {
    workspaceId,
    serviceKey,
    state: 'closed',
    failureCount: 0,
    successCount: (existing.successCount ?? 0) + 1,
    lastFailureAt: existing.lastFailureAt ?? null,
    nextAllowedAttemptAt: null,
    updatedAt: nowIso,
  };

  await docRef.set(updatedState);
  return updatedState;
}
