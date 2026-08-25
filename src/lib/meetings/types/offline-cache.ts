/**
 * @fileoverview Domain Types for Client Offline-First Booking Cache & Synchronization.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

export type OfflineMutationType = 'create_draft' | 'update_draft' | 'cancel_session' | 'check_in';

export interface OfflineMutationJob {
  id: string;
  type: OfflineMutationType;
  entityId: string;
  payload: Record<string, unknown>;
  clientTimestamp: string; // ISO 8601
  status: 'queued' | 'synced' | 'conflict' | 'failed';
  retryCount: number;
}

export interface OfflineReconciliationResult {
  syncedCount: number;
  conflictedCount: number;
  conflictedJobIds: string[];
  resolvedMutations: OfflineMutationJob[];
}
