'use client';

/**
 * @fileoverview Floating Interactive Network & Sync Status Pill (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Renders live network state with smooth CSS spring transitions and pulse animations.
 * - Section 84 touch target compliant (min-h-[44px], accessible ARIA roles).
 * - Clicking opens the OfflineSyncDrawer or ConflictResolutionModal based on state.
 * - Strictly typed without `any` or `any[]`.
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOfflineSync } from '../../../../../context/OfflineSyncContext';
import { getOfflineSyncStatusMeta } from '../../../../../lib/quick-notes-domain';
import { cn } from '../../../../../lib/utils';

interface NetworkStatusPillProps {
  onOpenDrawer: () => void;
  onOpenConflictModal?: () => void;
  className?: string;
}

export const NetworkStatusPill: React.FC<NetworkStatusPillProps> = ({
  onOpenDrawer,
  onOpenConflictModal,
  className,
}) => {
  const { syncStatus, pendingCount, conflictCount } = useOfflineSync();
  const meta = getOfflineSyncStatusMeta(syncStatus);

  const handleClick = () => {
    if (conflictCount > 0 && onOpenConflictModal) {
      onOpenConflictModal();
    } else {
      onOpenDrawer();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${meta.label}: ${meta.description}`}
      aria-label={`${meta.label}. ${pendingCount} pending mutations, ${conflictCount} conflicts.`}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 shadow-sm select-none',
        'min-h-[44px] sm:min-h-[36px] touch-manipulation active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40 outline-none',
        meta.badgeClass,
        className
      )}
    >
      {/* Dynamic State Icon */}
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            meta.dotClass
          )}
        />
        <span className={cn('relative inline-flex rounded-full h-2 w-2', meta.dotClass)} />
      </span>

      {syncStatus === 'online_synced' && (
        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Synced</span>
        </span>
      )}

      {syncStatus === 'syncing' && (
        <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing{pendingCount > 0 ? ` (${pendingCount})` : '...'}</span>
        </span>
      )}

      {syncStatus === 'offline' && (
        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
        </span>
      )}

      {syncStatus === 'conflict_detected' && (
        <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-semibold animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{conflictCount} Conflict{conflictCount > 1 ? 's' : ''}</span>
        </span>
      )}

      {syncStatus === 'error' && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Sync Error</span>
        </span>
      )}
    </button>
  );
};
