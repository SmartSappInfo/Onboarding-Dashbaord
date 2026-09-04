'use client';

/**
 * @fileoverview Visual 3-Way Offline Conflict Resolution Center (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Side-by-side visual diff comparison between local offline mutations and concurrent cloud updates.
 * - Supports 4 resolution actions: Keep Local, Keep Server, Smart Non-Destructive Merge, and Send to Inbox.
 * - Section 84 touch target compliant (min-h-[44px] buttons) and responsive on mobile viewports.
 * - Strictly typed without `any` or `any[]`.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../../components/ui/dialog';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import {
  AlertTriangle,
  Check,
  GitMerge,
  Inbox,
  Laptop,
  Cloud,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import type {
  OfflineConflictDetails,
  OfflineConflictResolutionAction,
  NoteDocument,
} from '../../../../../lib/quick-notes-types';
import { extractPlainText } from '../../../../../lib/quick-notes-domain';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: OfflineConflictDetails | null;
  onResolve: (action: OfflineConflictResolutionAction) => Promise<void>;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve,
}) => {
  const [isResolving, setIsResolving] = useState(false);

  if (!conflict) return null;

  const handleAction = async (action: OfflineConflictResolutionAction) => {
    setIsResolving(true);
    try {
      await onResolve(action);
      onClose();
    } finally {
      setIsResolving(false);
    }
  };

  const localDoc = conflict.localJob.payload.document as NoteDocument | undefined;
  const localText = extractPlainText(localDoc);
  const serverText = extractPlainText(conflict.serverSnapshot.document);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
            <DialogTitle className="text-lg sm:text-xl font-bold">
              Concurrent Edit Conflict Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            This note was modified on the server while you were working offline. Choose how you would
            like to reconcile the changes to prevent data loss.
          </DialogDescription>
        </DialogHeader>

        {/* Note Target Banner */}
        <div className="bg-muted/50 border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <FileText className="w-4 h-4 text-primary" />
            <span>Target: {conflict.entityTitle}</span>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono">
            ID: {conflict.entityId.slice(0, 8)}...
          </Badge>
        </div>

        {/* Side-by-Side Diff Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Left Column: Local Version */}
          <div className="border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-sm">
                  <Laptop className="w-4 h-4" />
                  <span>Your Local Offline Version</span>
                </div>
                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px]">
                  Local Draft
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Edited {new Date(conflict.clientTimestamp).toLocaleTimeString()}</span>
              </div>

              <div className="bg-background/80 border rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {localText || '<Empty document>'}
              </div>

              {/* Local Additions */}
              {conflict.diffSummary.localChanges.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 block mb-1">
                    + Local Additions:
                  </span>
                  <ul className="space-y-1">
                    {conflict.diffSummary.localChanges.map((change, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] bg-blue-500/10 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded border border-blue-500/20 truncate"
                      >
                        + {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => handleAction('keep_local')}
              disabled={isResolving}
              className="w-full mt-4 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Keep My Version (Overwrite Cloud)
            </Button>
          </div>

          {/* Right Column: Server Cloud Version */}
          <div className="border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold text-sm">
                  <Cloud className="w-4 h-4" />
                  <span>Server Cloud Version</span>
                </div>
                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px]">
                  Cloud Canonical
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Updated {new Date(conflict.serverUpdatedAt).toLocaleTimeString()}</span>
                </span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{conflict.serverSnapshot.authorName}</span>
                </span>
              </div>

              <div className="bg-background/80 border rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {serverText || '<Empty document>'}
              </div>

              {/* Server Additions */}
              {conflict.diffSummary.serverChanges.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block mb-1">
                    + Server Modifications:
                  </span>
                  <ul className="space-y-1">
                    {conflict.diffSummary.serverChanges.map((change, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] bg-purple-500/10 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded border border-purple-500/20 truncate"
                      >
                        + {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleAction('keep_server')}
              disabled={isResolving}
              className="w-full mt-4 min-h-[44px] border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-medium text-xs"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Accept Server Version (Discard Mine)
            </Button>
          </div>
        </div>

        {/* Smart Reconciliation Actions */}
        <div className="border-t pt-4 mt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleAction('smart_merge')}
            disabled={isResolving}
            className="w-full sm:w-auto min-h-[44px] text-xs font-medium"
          >
            <GitMerge className="w-4 h-4 mr-1.5 text-emerald-600" />
            Smart 3-Way Merge (Non-Destructive)
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleAction('send_to_inbox')}
            disabled={isResolving}
            className="w-full sm:w-auto min-h-[44px] text-xs text-muted-foreground hover:text-foreground"
          >
            <Inbox className="w-4 h-4 mr-1.5" />
            Send to Knowledge Inbox for Team Triage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
