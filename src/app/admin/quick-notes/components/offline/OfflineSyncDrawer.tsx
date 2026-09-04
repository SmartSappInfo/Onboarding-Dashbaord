'use client';

/**
 * @fileoverview Responsive Offline Sync Drawer & Diagnostics Workbench (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Provides visibility and manual control over the IndexedDB mutation queue, active conflicts, and cache storage.
 * - Adapts between desktop slide-over and mobile bottom sheet.
 * - Section 84 touch target compliant (min-h-[44px] touch targets).
 * - Strictly typed without `any` or `any[]`.
 */

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../../../../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../../components/ui/tabs';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Trash2,
  Clock,
  HardDrive,
  FileText,
  Layers,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useOfflineSync } from '../../../../../context/OfflineSyncContext';
import { OfflineStorageService } from '../../../../../lib/offline/offline-storage-service';
import type {
  OfflineMutationJob,
  OfflineConflictDetails,
} from '../../../../../lib/quick-notes-types';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { cn } from '../../../../../lib/utils';

interface OfflineSyncDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export const OfflineSyncDrawer: React.FC<OfflineSyncDrawerProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  const {
    isOnline,
    pendingCount,
    conflictCount,
    activeConflicts,
    storageStats,
    triggerSync,
    resolveConflict,
    purgeCache,
    refreshStats,
  } = useOfflineSync();

  const [activeTab, setActiveTab] = useState<'queue' | 'conflicts' | 'storage'>('queue');
  const [allJobs, setAllJobs] = useState<OfflineMutationJob[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<OfflineConflictDetails | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Load all mutation jobs when drawer opens
  useEffect(() => {
    if (isOpen && workspaceId) {
      OfflineStorageService.getAllMutations(workspaceId).then(setAllJobs);
      refreshStats();
    }
  }, [isOpen, workspaceId, refreshStats]);

  const handleDrainNow = async () => {
    setIsBusy(true);
    try {
      await triggerSync();
      const updated = await OfflineStorageService.getAllMutations(workspaceId);
      setAllJobs(updated);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    await OfflineStorageService.removeMutation(jobId);
    const updated = await OfflineStorageService.getAllMutations(workspaceId);
    setAllJobs(updated);
    refreshStats();
  };

  const handlePurgeCache = async () => {
    if (confirm('Purge local cached notes? Pending mutations will be preserved.')) {
      setIsBusy(true);
      try {
        await purgeCache(true);
      } finally {
        setIsBusy(false);
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col justify-between bg-background z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b bg-muted/30">
            <SheetHeader className="text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      isOnline
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <SheetTitle className="text-base sm:text-lg font-bold">
                      Offline Sync & Storage
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {isOnline ? 'Connected to Cloud Firestore' : 'Working in local IndexedDB mode'}
                    </SheetDescription>
                  </div>
                </div>

                <Badge
                  variant={isOnline ? 'default' : 'secondary'}
                  className={cn(
                    'text-xs font-semibold',
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  )}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
            </SheetHeader>

            {/* Quick Action Ribbon */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                type="button"
                onClick={handleDrainNow}
                disabled={!isOnline || isBusy || pendingCount === 0}
                size="sm"
                className="flex-1 min-h-[44px] sm:min-h-[36px] bg-primary text-primary-foreground font-medium text-xs shadow-sm"
              >
                <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isBusy && 'animate-spin')} />
                {isBusy ? 'Syncing...' : `Drain Queue (${pendingCount})`}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => refreshStats()}
                size="sm"
                className="min-h-[44px] sm:min-h-[36px] text-xs"
                title="Refresh diagnostics"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'queue' | 'conflicts' | 'storage')}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-3 border-b bg-background">
              <TabsList className="grid grid-cols-3 w-full h-9">
                <TabsTrigger value="queue" className="text-xs">
                  Queue ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="conflicts" className="text-xs">
                  Conflicts ({conflictCount})
                </TabsTrigger>
                <TabsTrigger value="storage" className="text-xs">
                  Storage
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: MUTATION QUEUE */}
            <TabsContent value="queue" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
              {allJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-sm font-medium">Mutation Queue is Clean</p>
                  <p className="text-xs mt-1">All local operations have synced to the cloud.</p>
                </div>
              ) : (
                allJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {job.type.replace('_', ' ')}
                        </Badge>
                        <span className="font-semibold text-foreground truncate max-w-[180px]">
                          {(job.payload.title as string) || job.entityId}
                        </span>
                      </div>

                      <Badge
                        className={cn(
                          'text-[10px]',
                          job.status === 'pending' && 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                          job.status === 'syncing' && 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
                          job.status === 'conflict' && 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
                          job.status === 'failed' && 'bg-red-500/20 text-red-700 dark:text-red-300',
                          job.status === 'synced' && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        )}
                      >
                        {job.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.clientTimestamp).toLocaleTimeString()}
                      </span>

                      {job.retryCount > 0 && <span>Retries: {job.retryCount}</span>}
                    </div>

                    {job.lastError && (
                      <div className="text-[11px] bg-red-500/10 text-red-700 dark:text-red-300 p-1.5 rounded border border-red-500/20">
                        {job.lastError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1 border-t border-muted">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveJob(job.id)}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Discard
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 2: ACTIVE CONFLICTS */}
            <TabsContent value="conflicts" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
              {activeConflicts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-sm font-medium">No Active Conflicts</p>
                  <p className="text-xs mt-1">All concurrent edits are cleanly aligned.</p>
                </div>
              ) : (
                activeConflicts.map((conflict) => (
                  <div
                    key={conflict.jobId}
                    className="border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 rounded-xl p-4 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-700 dark:text-rose-300 text-sm">
                          {conflict.entityTitle}
                        </span>
                        <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px]">
                          Conflict
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        Offline edit clashed with server update at{' '}
                        {new Date(conflict.serverUpdatedAt).toLocaleTimeString()}.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setSelectedConflict(conflict)}
                      className="w-full min-h-[44px] sm:min-h-[36px] bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                      Compare & Resolve Diff
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 3: STORAGE & DIAGNOSTICS */}
            <TabsContent value="storage" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 bg-muted/20 flex flex-col justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Cached Notes
                  </span>
                  <span className="text-xl font-bold mt-1">
                    {storageStats?.cachedNotesCount ?? 0}
                  </span>
                </div>

                <div className="border rounded-lg p-3 bg-muted/20 flex flex-col justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    Pending Jobs
                  </span>
                  <span className="text-xl font-bold mt-1">
                    {storageStats?.pendingMutationsCount ?? 0}
                  </span>
                </div>

                <div className="border rounded-lg p-3 bg-muted/20 flex flex-col justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                    Local Drafts
                  </span>
                  <span className="text-xl font-bold mt-1">
                    {storageStats?.localDraftsCount ?? 0}
                  </span>
                </div>

                <div className="border rounded-lg p-3 bg-muted/20 flex flex-col justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    Estimated Storage
                  </span>
                  <span className="text-xl font-bold mt-1">
                    {formatBytes(storageStats?.storageBytesEstimated ?? 0)}
                  </span>
                </div>
              </div>

              {/* Maintenance Tools */}
              <div className="border rounded-xl p-4 bg-muted/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Maintenance Tools
                </h4>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePurgeCache}
                  disabled={isBusy}
                  className="w-full min-h-[44px] justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/20"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Purge Local Note Mirror (Keeps Queue)
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>IndexedDB: {storageStats?.isIndexedDbSupported ? 'Active' : 'Memory Driver'}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[32px] text-xs"
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Visual Conflict Modal */}
      {selectedConflict && (
        <ConflictResolutionModal
          isOpen={Boolean(selectedConflict)}
          onClose={() => setSelectedConflict(null)}
          conflict={selectedConflict}
          onResolve={async (action) => {
            await resolveConflict(selectedConflict, action);
            setSelectedConflict(null);
            const updated = await OfflineStorageService.getAllMutations(workspaceId);
            setAllJobs(updated);
          }}
        />
      )}
    </>
  );
};
