'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FastForward, StopCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { reconcileOrphanedRunsAction, type OrphanedRunInfo } from '@/app/actions/orphaned-runs-reconciliation-actions';

interface OrphanedRunsCleanupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  automationId?: string;
  orphanedRuns: OrphanedRunInfo[];
  onSuccess?: () => void;
}

export function OrphanedRunsCleanupModal({
  open,
  onOpenChange,
  workspaceId,
  userId,
  automationId,
  orphanedRuns,
  onSuccess,
}: OrphanedRunsCleanupModalProps) {
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<'advance_all' | 'cancel_all'>('advance_all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExecuteReconciliation = async () => {
    if (!workspaceId || !userId) {
      toast({
        title: 'Error',
        description: 'Workspace ID and User ID context missing.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const runIds = orphanedRuns.map((r) => r.runId);
      const res = await reconcileOrphanedRunsAction({
        workspaceId,
        userId,
        strategy: selectedStrategy,
        runIds,
        automationId,
      });

      if (res.success) {
        toast({
          title: 'Orphaned Runs Cleaned',
          description: `Successfully ${selectedStrategy === 'advance_all' ? 'advanced' : 'cancelled'} ${res.totalProcessed} orphaned run(s).`,
        });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Cleanup Failed',
          description: res.error || 'Failed to reconcile orphaned runs.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-xl w-[95vw] rounded-2xl p-6 sm:p-7 shadow-2xl border border-border/60">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
              Orphaned Parked Contacts ({orphanedRuns.length})
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {orphanedRuns.length} contact run(s) are currently waiting at steps that were removed from the automation canvas. Choose how to handle these orphaned contacts.
          </DialogDescription>
        </DialogHeader>

        {/* Affected Contacts List Preview */}
        <div className="my-3 max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs">
          {orphanedRuns.map((r) => (
            <div key={r.runId} className="flex items-center justify-between py-1 px-2 rounded-lg bg-background/80 border border-border/40">
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {r.entityName || r.entityId || 'Contact'}
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                {r.orphanedNodeLabel || 'Deleted Step'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Strategy Selection Options */}
        <div className="space-y-3 my-2">
          <button
            type="button"
            onClick={() => setSelectedStrategy('advance_all')}
            className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all active:scale-[0.97] flex items-start gap-3 ${
              selectedStrategy === 'advance_all'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border/60 hover:bg-muted/40'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedStrategy === 'advance_all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <FastForward className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                Release & Advance to Next Valid Step
                {selectedStrategy === 'advance_all' && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Skips the deleted wait step and advances contacts to the next valid step in the automation flow (or completes them if no steps remain).
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStrategy('cancel_all')}
            className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all active:scale-[0.97] flex items-start gap-3 ${
              selectedStrategy === 'cancel_all'
                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500/30'
                : 'border-border/60 hover:bg-muted/40'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedStrategy === 'cancel_all' ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              <StopCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                Force End / Cancel Orphaned Runs
                {selectedStrategy === 'cancel_all' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Terminates active runs for all orphaned contacts immediately and purges associated pending wait timers.
              </p>
            </div>
          </button>
        </div>

        <Alert variant={selectedStrategy === 'cancel_all' ? 'destructive' : 'default'} className="mt-2 text-xs py-2 px-3">
          <AlertTitle className="font-semibold text-xs">Confirmation Required</AlertTitle>
          <AlertDescription className="text-[11px]">
            {selectedStrategy === 'advance_all'
              ? `You are about to advance ${orphanedRuns.length} contact(s) to the next valid step.`
              : `You are about to cancel ${orphanedRuns.length} orphaned run(s). This cannot be undone.`}
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-[44px] active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            variant={selectedStrategy === 'cancel_all' ? 'destructive' : 'default'}
            onClick={handleExecuteReconciliation}
            disabled={isSubmitting}
            className="min-h-[44px] active:scale-[0.97] gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Strategy & Resolve Runs'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
