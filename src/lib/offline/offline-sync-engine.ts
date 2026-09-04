/**
 * @fileoverview Client-Side Offline Sync Engine & Reconnection Orchestrator (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Drains the IndexedDB mutation queue using chunked Server Actions upon network restoration.
 * - Enforces in-memory mutex locks to prevent flapping network sync storms.
 * - Broadcasts real-time sync progress across multiple browser tabs via BroadcastChannel.
 * - Strictly typed without `any` or `any[]`.
 */

import { OfflineStorageService } from './offline-storage-service';
import { commitOfflineBatchAction } from '../quick-notes-offline-actions';
import { resolveOfflineConflict, computeOfflineBackoffDelay } from '../quick-notes-domain';
import type {
  OfflineMutationJob,
  OfflineConflictResolutionAction,
  QuickNote,
  OfflineConflictDetails,
} from '../quick-notes-types';

export interface OfflineSyncBroadcastEvent {
  type: 'queue_updated' | 'sync_started' | 'sync_completed' | 'conflict_detected' | 'cache_cleared';
  workspaceId: string;
  timestamp: string;
  pendingCount?: number;
  syncedCount?: number;
  conflictDetails?: OfflineConflictDetails;
}

const BROADCAST_CHANNEL_NAME = 'smartsapp_offline_sync_channel';

// Mutex flag preventing concurrent draining runs
let isDraining = false;
let broadcastChannel: BroadcastChannel | null = null;
const eventListeners = new Set<(event: OfflineSyncBroadcastEvent) => void>();

/**
 * Initializes or returns the shared BroadcastChannel instance for cross-tab communication.
 */
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (msg: MessageEvent<OfflineSyncBroadcastEvent>) => {
        if (msg.data) {
          eventListeners.forEach((listener) => listener(msg.data));
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }
  return broadcastChannel;
}

export const OfflineSyncEngine = {
  /**
   * Broadcasts a sync event across all open browser tabs and local listeners.
   */
  broadcast(event: OfflineSyncBroadcastEvent): void {
    eventListeners.forEach((listener) => listener(event));
    const channel = getBroadcastChannel();
    if (channel) {
      try {
        channel.postMessage(event);
      } catch {
        // Broadcast failed silently
      }
    }
  },

  /**
   * Subscribes to real-time offline sync broadcast events.
   */
  subscribe(callback: (event: OfflineSyncBroadcastEvent) => void): () => void {
    eventListeners.add(callback);
    getBroadcastChannel(); // ensure channel initialized
    return () => {
      eventListeners.delete(callback);
    };
  },

  /**
   * Pre-caches notes into IndexedDB for instant offline loading.
   */
  async precacheWorkspace(workspaceId: string, notes: QuickNote[]): Promise<void> {
    if (!workspaceId || !Array.isArray(notes)) return;
    await OfflineStorageService.putCachedNotes(workspaceId, notes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`smartsapp_last_sync_${workspaceId}`, new Date().toISOString());
      } catch {
        // ignore
      }
    }
  },

  /**
   * Drains pending mutations from IndexedDB and commits them to Cloud Firestore via Server Action.
   */
  async drainQueue(workspaceId: string): Promise<{
    synced: number;
    conflicted: number;
    failed: number;
  }> {
    if (!workspaceId || isDraining) {
      return { synced: 0, conflicted: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, conflicted: 0, failed: 0 };
    }

    isDraining = true;
    let totalSynced = 0;
    let totalConflicted = 0;
    let totalFailed = 0;

    try {
      this.broadcast({
        type: 'sync_started',
        workspaceId,
        timestamp: new Date().toISOString(),
      });

      const pendingJobs = await OfflineStorageService.getPendingMutations(workspaceId);

      if (pendingJobs.length === 0) {
        isDraining = false;
        this.broadcast({
          type: 'sync_completed',
          workspaceId,
          timestamp: new Date().toISOString(),
          pendingCount: 0,
          syncedCount: 0,
        });
        return { synced: 0, conflicted: 0, failed: 0 };
      }

      // Mark jobs as syncing
      for (const job of pendingJobs) {
        await OfflineStorageService.updateMutationStatus(job.id, 'syncing');
      }

      // Process in batches of 25 to ensure rapid responsiveness
      const BATCH_SIZE = 25;
      for (let i = 0; i < pendingJobs.length; i += BATCH_SIZE) {
        const batch = pendingJobs.slice(i, i + BATCH_SIZE);
        const result = await commitOfflineBatchAction({
          workspaceId,
          jobs: batch,
        });

        if (result.success && result.data) {
          const { syncedJobIds, conflictedJobs, failedJobs } = result.data;

          // 1. Remove successfully synced mutations
          for (const syncedId of syncedJobIds) {
            await OfflineStorageService.removeMutation(syncedId);
            totalSynced++;
          }

          // 2. Mark conflicts and emit conflict notifications
          for (const conflict of conflictedJobs) {
            await OfflineStorageService.updateMutationStatus(
              conflict.jobId,
              'conflict',
              'Concurrent modification conflict detected.'
            );
            totalConflicted++;

            const job = batch.find((j) => j.id === conflict.jobId);
            if (job) {
              const conflictEval = resolveOfflineConflict({
                localJob: job,
                serverSnapshot: conflict.serverSnapshot,
              });

              if (conflictEval.conflictDetails) {
                this.broadcast({
                  type: 'conflict_detected',
                  workspaceId,
                  timestamp: new Date().toISOString(),
                  conflictDetails: conflictEval.conflictDetails,
                });
              }
            }
          }

          // 3. Mark failed mutations with retry counts
          for (const fail of failedJobs) {
            const job = batch.find((j) => j.id === fail.jobId);
            const retryCount = (job?.retryCount || 0) + 1;
            const backoff = computeOfflineBackoffDelay(retryCount);

            await OfflineStorageService.updateMutationStatus(
              fail.jobId,
              'failed',
              `Failed: ${fail.error}. Retry in ${Math.round(backoff / 1000)}s`
            );
            totalFailed++;
          }
        } else {
          // Entire batch failed
          for (const job of batch) {
            await OfflineStorageService.updateMutationStatus(
              job.id,
              'failed',
              result.error || 'Batch commit failed.'
            );
            totalFailed++;
          }
        }
      }

      const remainingPending = await OfflineStorageService.getPendingMutations(workspaceId);

      this.broadcast({
        type: 'sync_completed',
        workspaceId,
        timestamp: new Date().toISOString(),
        pendingCount: remainingPending.length,
        syncedCount: totalSynced,
      });

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`smartsapp_last_sync_${workspaceId}`, new Date().toISOString());
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('[OfflineSyncEngine] Error during queue drain:', err);
    } finally {
      isDraining = false;
    }

    return {
      synced: totalSynced,
      conflicted: totalConflicted,
      failed: totalFailed,
    };
  },

  /**
   * Resolves a clashing offline mutation using the chosen strategy.
   */
  async resolveConflict(params: {
    jobId: string;
    workspaceId: string;
    action: OfflineConflictResolutionAction;
    localJob: OfflineMutationJob;
    serverSnapshot: QuickNote;
  }): Promise<void> {
    const { jobId, workspaceId, action, localJob, serverSnapshot } = params;

    const resolution = resolveOfflineConflict({
      localJob,
      serverSnapshot,
      action,
    });

    if (action === 'keep_server') {
      // Discard local mutation and update local cache with server snapshot
      await OfflineStorageService.removeMutation(jobId);
      await OfflineStorageService.putCachedNote(serverSnapshot);
    } else if (action === 'keep_local' || action === 'smart_merge') {
      // Update mutation payload with resolved document and re-enqueue as pending
      const updatedJob: OfflineMutationJob = {
        ...localJob,
        payload: resolution.resolvedPayload || localJob.payload,
        baseServerUpdatedAt: serverSnapshot.updatedAt, // update base timestamp to current server
        status: 'pending',
        retryCount: 0,
        lastError: undefined,
      };

      await OfflineStorageService.enqueueMutation(updatedJob);
      // Trigger immediate sync
      await this.drainQueue(workspaceId);
    } else if (action === 'send_to_inbox') {
      // Remove from mutation queue, server note remains as is
      await OfflineStorageService.removeMutation(jobId);
    }

    this.broadcast({
      type: 'queue_updated',
      workspaceId,
      timestamp: new Date().toISOString(),
    });
  },
};
