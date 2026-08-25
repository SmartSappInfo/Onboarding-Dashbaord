/**
 * @fileoverview Pure Offline Booking Queue & Conflict Reconciliation Service.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Deterministic conflict resolution using monotonic server update timestamps.
 * - 100% pure with zero side-effects.
 */

import type {
  OfflineMutationJob,
  OfflineReconciliationResult,
} from './types/offline-cache';

/**
 * Reconciles offline queued mutations against real-time server entity snapshots.
 */
export function reconcileOfflineQueue(
  queuedMutations: OfflineMutationJob[],
  serverSnapshots: Record<string, { updatedAt: string }>
): OfflineReconciliationResult {
  let synced = 0;
  let conflicted = 0;
  const conflictedIds: string[] = [];
  const resolved: OfflineMutationJob[] = [];

  for (const job of queuedMutations) {
    const serverEntity = serverSnapshots[job.entityId];

    if (!serverEntity) {
      // Entity is new or not found on server -> sync without conflict
      resolved.push({ ...job, status: 'synced' });
      synced++;
      continue;
    }

    const clientMs = new Date(job.clientTimestamp).getTime();
    const serverMs = new Date(serverEntity.updatedAt).getTime();

    // If server was updated AFTER client mutation was queued, flag conflict
    if (serverMs > clientMs) {
      resolved.push({ ...job, status: 'conflict' });
      conflicted++;
      conflictedIds.push(job.id);
    } else {
      resolved.push({ ...job, status: 'synced' });
      synced++;
    }
  }

  return {
    syncedCount: synced,
    conflictedCount: conflicted,
    conflictedJobIds: conflictedIds,
    resolvedMutations: resolved,
  };
}
