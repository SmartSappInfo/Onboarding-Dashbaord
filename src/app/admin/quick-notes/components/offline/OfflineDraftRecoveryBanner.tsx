'use client';

/**
 * @fileoverview Contextual Offline Draft Recovery Banner (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Alerts the user when an uncommitted local scratchpad draft was preserved in IndexedDB.
 * - Provides 1-click restore and discard actions.
 * - Section 84 touch target compliant (min-h-[44px] buttons).
 * - Strictly typed without `any` or `any[]`.
 */

import React from 'react';
import { Button } from '../../../../../components/ui/button';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import type { OfflineLocalDraft } from '../../../../../lib/quick-notes-types';

interface OfflineDraftRecoveryBannerProps {
  draft: OfflineLocalDraft | null;
  onRestore: (draft: OfflineLocalDraft) => void;
  onDismiss: () => void;
}

export const OfflineDraftRecoveryBanner: React.FC<OfflineDraftRecoveryBannerProps> = ({
  draft,
  onRestore,
  onDismiss,
}) => {
  if (!draft) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 rounded-xl p-3 sm:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
      <div className="flex items-start sm:items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
        <div>
          <span className="font-semibold block sm:inline">Unsaved Offline Draft Found</span>
          <span className="text-muted-foreground ml-0 sm:ml-1.5 block sm:inline">
            A local draft was saved on {new Date(draft.updatedAt).toLocaleTimeString()}.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => onRestore(draft)}
          className="min-h-[44px] sm:min-h-[32px] bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm flex-1 sm:flex-none"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Restore Draft
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="min-h-[44px] sm:min-h-[32px] text-muted-foreground hover:text-foreground text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1 sm:mr-0" />
          <span className="sm:hidden">Discard</span>
        </Button>
      </div>
    </div>
  );
};
