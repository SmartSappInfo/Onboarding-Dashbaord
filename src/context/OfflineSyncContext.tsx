'use client';

/**
 * @fileoverview Global React 19 Context & State Provider for Offline Sync & Zero-Data-Loss PWA (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Subscribes to native window online/offline events with safe SSR hydration defaults.
 * - Manages reactive queue counts, conflict collections, and storage statistics.
 * - Automatically drains the mutation queue upon network reconnection.
 * - Strictly typed without `any` or `any[]`.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { OfflineStorageService } from '../lib/offline/offline-storage-service';
import { OfflineSyncEngine, OfflineSyncBroadcastEvent } from '../lib/offline/offline-sync-engine';
import { resolveOfflineConflict } from '../lib/quick-notes-domain';
import type {
  OfflineSyncStatus,
  OfflineConflictDetails,
  OfflineConflictResolutionAction,
  OfflineStorageStats,
  QuickNote,
} from '../lib/quick-notes-types';

interface OfflineSyncContextValue {
  isOnline: boolean;
  syncStatus: OfflineSyncStatus;
  pendingCount: number;
  conflictCount: number;
  activeConflicts: OfflineConflictDetails[];
  storageStats: OfflineStorageStats | null;
  triggerSync: () => Promise<void>;
  resolveConflict: (
    conflict: OfflineConflictDetails,
    action: OfflineConflictResolutionAction
  ) => Promise<void>;
  precacheWorkspace: (notes: QuickNote[]) => Promise<void>;
  purgeCache: (preserveQueue?: boolean) => Promise<void>;
  refreshStats: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export interface OfflineSyncProviderProps {
  workspaceId: string;
  children: React.ReactNode;
}

export const OfflineSyncProvider: React.FC<OfflineSyncProviderProps> = ({
  workspaceId,
  children,
}) => {
  // SSR-safe default: assume online during initial render
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeConflicts, setActiveConflicts] = useState<OfflineConflictDetails[]>([]);
  const [storageStats, setStorageStats] = useState<OfflineStorageStats | null>(null);

  // --------------------------------------------------------------------------
  // REFRESH METRICS & STATS
  // --------------------------------------------------------------------------

  const refreshStats = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const stats = await OfflineStorageService.getStorageStats(workspaceId);
      setStorageStats(stats);
      setPendingCount(stats.pendingMutationsCount);

      // Inspect queue for conflicts
      const allJobs = await OfflineStorageService.getAllMutations(workspaceId);
      const conflictJobs = allJobs.filter((j) => j.status === 'conflict');

      if (conflictJobs.length > 0) {
        const conflicts: OfflineConflictDetails[] = conflictJobs.map((job) => {
          const mockSnapshot: QuickNote = {
            id: job.entityId,
            workspaceId: job.workspaceId,
            authorId: 'server-author',
            authorName: 'Cloud Server',
            title: (job.payload.title as string) || 'Cloud Document',
            content: '',
            document: job.payload.document as QuickNote['document'],
            tags: (job.payload.tags as string[]) || [],
            createdAt: job.baseServerUpdatedAt || new Date().toISOString(),
            updatedAt: job.baseServerUpdatedAt || new Date().toISOString(),
          };

          const evalResult = resolveOfflineConflict({
            localJob: job,
            serverSnapshot: mockSnapshot,
          });

          return (
            evalResult.conflictDetails || {
              jobId: job.id,
              entityId: job.entityId,
              entityTitle: (job.payload.title as string) || 'Untitled Note',
              localJob: job,
              serverSnapshot: mockSnapshot,
              clientTimestamp: job.clientTimestamp,
              serverUpdatedAt: mockSnapshot.updatedAt,
              diffSummary: { localChanges: ['Local offline edits'], serverChanges: ['Cloud modifications'] },
            }
          );
        });
        setActiveConflicts(conflicts);
      } else {
        setActiveConflicts([]);
      }
    } catch (err) {
      console.warn('[OfflineSyncContext] Failed to refresh stats:', err);
    }
  }, [workspaceId]);

  // --------------------------------------------------------------------------
  // TRIGGER QUEUE DRAIN
  // --------------------------------------------------------------------------

  const triggerSync = useCallback(async () => {
    if (!workspaceId || !isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      await OfflineSyncEngine.drainQueue(workspaceId);
    } finally {
      setIsSyncing(false);
      await refreshStats();
    }
  }, [workspaceId, isOnline, isSyncing, refreshStats]);

  // --------------------------------------------------------------------------
  // RESOLVE CONFLICT
  // --------------------------------------------------------------------------

  const resolveConflict = useCallback(
    async (conflict: OfflineConflictDetails, action: OfflineConflictResolutionAction) => {
      if (!workspaceId) return;

      await OfflineSyncEngine.resolveConflict({
        jobId: conflict.jobId,
        workspaceId,
        action,
        localJob: conflict.localJob,
        serverSnapshot: conflict.serverSnapshot,
      });

      await refreshStats();
    },
    [workspaceId, refreshStats]
  );

  // --------------------------------------------------------------------------
  // PRECACHE & PURGE
  // --------------------------------------------------------------------------

  const precacheWorkspace = useCallback(
    async (notes: QuickNote[]) => {
      if (!workspaceId || !Array.isArray(notes)) return;
      await OfflineSyncEngine.precacheWorkspace(workspaceId, notes);
      await refreshStats();
    },
    [workspaceId, refreshStats]
  );

  const purgeCache = useCallback(
    async (preserveQueue = true) => {
      if (!workspaceId) return;
      await OfflineStorageService.clearWorkspaceCache(workspaceId, preserveQueue);
      await refreshStats();
    },
    [workspaceId, refreshStats]
  );

  // --------------------------------------------------------------------------
  // LIFECYCLE & EVENT LISTENERS
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial browser online check
    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. BroadcastChannel subscriber
    const unsubscribeBroadcast = OfflineSyncEngine.subscribe((event: OfflineSyncBroadcastEvent) => {
      if (event.workspaceId === workspaceId) {
        if (event.type === 'sync_started') {
          setIsSyncing(true);
        } else if (event.type === 'sync_completed') {
          setIsSyncing(false);
          refreshStats();
        } else if (event.type === 'conflict_detected' || event.type === 'queue_updated') {
          refreshStats();
        }
      }
    });

    // Initial stats load
    refreshStats();

    // 3. Periodic online sync heartbeat (every 30s)
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        triggerSync();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeBroadcast();
      clearInterval(interval);
    };
  }, [workspaceId, triggerSync, refreshStats, isSyncing]);

  // Derive composite syncStatus
  const syncStatus: OfflineSyncStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (activeConflicts.length > 0) return 'conflict_detected';
    if (isSyncing) return 'syncing';
    return 'online_synced';
  }, [isOnline, activeConflicts.length, isSyncing]);

  const value = useMemo(
    () => ({
      isOnline,
      syncStatus,
      pendingCount,
      conflictCount: activeConflicts.length,
      activeConflicts,
      storageStats,
      triggerSync,
      resolveConflict,
      precacheWorkspace,
      purgeCache,
      refreshStats,
    }),
    [
      isOnline,
      syncStatus,
      pendingCount,
      activeConflicts,
      storageStats,
      triggerSync,
      resolveConflict,
      precacheWorkspace,
      purgeCache,
      refreshStats,
    ]
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
};

export function useOfflineSync(): OfflineSyncContextValue {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return context;
}
