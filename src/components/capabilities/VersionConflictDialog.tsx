'use client';

/**
 * @fileOverview TOCTOU Version Conflict Dialog (Phase 1 / PR-9)
 *
 * Implements Rule 18 (TOCTOU Concurrency Guard), Rule 51 (Conflict Resolution UX),
 * and Workspace Modal Architecture (`theme.md` Section 8).
 *
 * Surface & Geometry:
 * - Demarcated header (<DialogHeader demarcated>)
 * - CardInfoTooltip for descriptions (Zero Raw Descriptions)
 * - Screen-reader only description (<DialogDescription className="sr-only">)
 * - Demarcated footer with tactile touch buttons (min-h-[44px], active:scale-[0.97])
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { GitCompare, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

export interface VersionConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedVersion?: string | number;
  actualVersion?: string | number;
  onReload: () => void | Promise<void>;
  onOverwrite?: () => void | Promise<void>;
  resourceName?: string;
}

export function VersionConflictDialog({
  open,
  onOpenChange,
  expectedVersion,
  actualVersion,
  onReload,
  onOverwrite,
  resourceName = 'record',
}: VersionConflictDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleReload = async () => {
    setIsProcessing(true);
    try {
      await onReload();
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOverwrite = async () => {
    if (!onOverwrite) return;
    setIsProcessing(true);
    try {
      await onOverwrite();
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl"
        showCloseButton
      >
        {/* Demarcated Header (Standardized Modal Architecture) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-amber-500" />
            <DialogTitle className="text-base font-semibold">
              Conflict Detected
            </DialogTitle>
            <CardInfoTooltip text="Another user or automation updated this record while you were editing. Review versions to avoid overwriting recent changes." />
          </div>
          <DialogDescription className="sr-only">
            Another user or process updated this record while you were editing.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm text-foreground">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Outdated {resourceName} version
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The version of this {resourceName} you were editing has been modified by another process.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
              <span className="text-muted-foreground font-medium">Your Version:</span>
              <p className="font-mono text-sm font-semibold">
                {expectedVersion !== undefined ? String(expectedVersion) : 'Unknown'}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
              <span className="text-muted-foreground font-medium">Server Version:</span>
              <p className="font-mono text-sm font-semibold text-primary">
                {actualVersion !== undefined ? String(actualVersion) : 'Latest'}
              </p>
            </div>
          </div>
        </div>

        {/* Demarcated Footer (Standardized Modal Architecture) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleReload}
            disabled={isProcessing}
            className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <RefreshCw className={isProcessing ? 'animate-spin h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
            <span>Reload Latest</span>
          </Button>

          {onOverwrite && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleOverwrite}
              disabled={isProcessing}
              className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform"
            >
              <span>Overwrite</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
