/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Non-Blocking Shadow-Read Verifier & Discrepancy Telemetry (Phase 7):
 * 1. Purpose (DocSigning_roadmap.md §13.1):
 *    Validates live parity between legacy and modern domain read paths without
 *    impacting end-user performance:
 *    - Caller receives legacy result immediately (zero blocking delay FM-P7-08).
 *    - In the background, modern reader executes and results are deep-compared.
 *    - Diffs and match rates are persisted to `workspaces/{workspaceId}/shadow_read_telemetry`.
 * 2. Strict Tenant Scoping (Rule 5 & 8):
 *    All telemetry records partition strictly under `workspaces/{workspaceId}/...`.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';

export interface ShadowReadParams<T> {
  workspaceId: string;
  entityType: string;
  entityId: string;
  legacyReader: () => Promise<T>;
  modernReader: () => Promise<T>;
  comparator?: (legacy: T, modern: T) => boolean;
}

export interface ShadowReadTelemetryRecord {
  telemetryId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  matched: boolean;
  legacySnapshot: Record<string, unknown> | null;
  modernSnapshot: Record<string, unknown> | null;
  recordedAt: string;
}

export interface ShadowReadParityMetrics {
  totalReads: number;
  matchedReads: number;
  discrepancyCount: number;
  parityPercentage: number;
}

/**
 * Deep-compares two snapshot objects deterministically.
 */
export function compareEntitySnapshots(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Executes a primary legacy read immediately while asynchronously shadow-executing
 * the modern reader in the background to capture parity telemetry without adding latency.
 */
export async function executeShadowRead<T>(params: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  legacyReader: () => Promise<T>;
  modernReader: () => Promise<T>;
  comparator?: (legacy: T, modern: T) => boolean;
}): Promise<T> {
  const { workspaceId, entityType, entityId, legacyReader, modernReader, comparator } = params;

  // 1. Execute legacy reader synchronously for caller
  const legacyResult = await legacyReader();

  // 2. Execute modern reader asynchronously without blocking caller (FM-P7-08)
  void (async () => {
    try {
      const modernResult = await modernReader();
      const matched = comparator
        ? comparator(legacyResult, modernResult)
        : compareEntitySnapshots(legacyResult, modernResult);

      const nowIso = new Date().toISOString();
      const telemetryId = `shad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const telemetryRecord: ShadowReadTelemetryRecord = {
        telemetryId,
        workspaceId,
        entityType,
        entityId,
        matched,
        legacySnapshot: typeof legacyResult === 'object' && legacyResult !== null ? (legacyResult as Record<string, unknown>) : null,
        modernSnapshot: typeof modernResult === 'object' && modernResult !== null ? (modernResult as Record<string, unknown>) : null,
        recordedAt: nowIso,
      };

      await adminDb
        .collection(`workspaces/${workspaceId}/shadow_read_telemetry`)
        .doc(telemetryId)
        .set(telemetryRecord);
    } catch (err: unknown) {
      console.warn(`[executeShadowRead] background check failed for ${entityType}/${entityId}:`, err);
    }
  })();

  return legacyResult;
}

/**
 * Aggregates recent shadow read telemetry to compute live rolling parity percentage.
 */
export async function getShadowReadParityMetrics(
  workspaceId: string
): Promise<ShadowReadParityMetrics> {
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/shadow_read_telemetry`)
    .limit(100)
    .get();

  if (snapshot.empty) {
    return {
      totalReads: 0,
      matchedReads: 0,
      discrepancyCount: 0,
      parityPercentage: 100.0,
    };
  }

  let matchedReads = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as { matched?: boolean };
    if (data.matched) {
      matchedReads++;
    }
  }

  const totalReads = snapshot.size;
  const discrepancyCount = totalReads - matchedReads;
  const parityPercentage = Math.round((matchedReads / totalReads) * 100);

  return {
    totalReads,
    matchedReads,
    discrepancyCount,
    parityPercentage,
  };
}
