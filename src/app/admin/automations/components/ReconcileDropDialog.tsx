'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Move, Copy, GitCommit, GitMerge } from 'lucide-react';
import type { SplicingOptions } from '@/lib/automations/graph-rewriter';

interface ReconcileDropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draggedNodeLabel: string;
  targetEdgeLabel: string;
  onConfirm: (options: SplicingOptions) => void;
  onCancel: () => void;
}

export function ReconcileDropDialog({
  open,
  onOpenChange,
  draggedNodeLabel,
  targetEdgeLabel,
  onConfirm,
  onCancel,
}: ReconcileDropDialogProps) {
  const [action, setAction] = React.useState<'move' | 'copy'>('move');
  const [scope, setScope] = React.useState<'single' | 'subtree'>('single');
  const [healGap, setHealGap] = React.useState<boolean>(true);

  // Reset internal states on open
  React.useEffect(() => {
    if (open) {
      setAction('move');
      setScope('single');
      setHealGap(true);
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm({ action, scope, healGap });
  };

  const handleClose = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="rounded-3xl max-w-md border border-border/20 shadow-2xl p-0 bg-background/95 backdrop-blur-md overflow-hidden">
        {/* Top visual brand stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/80 via-primary to-primary/80" />

        <div className="px-6 pt-5 pb-2">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <GitMerge className="h-4 w-4 text-primary" />
              </div>
              Reconcile Graph Change
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Configure how <span className="font-semibold text-foreground">"{draggedNodeLabel}"</span> should be spliced into the connector path.
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 space-y-6">
            {/* Action Segmented Control */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                Action Mode
                <HelpCircle className="h-3 w-3 text-muted-foreground/45" />
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-muted-foreground/10">
                <button
                  type="button"
                  onClick={() => setAction('move')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                    action === 'move'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Move className="h-3.5 w-3.5" />
                  Move Step
                </button>
                <button
                  type="button"
                  onClick={() => setAction('copy')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                    action === 'copy'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Step
                </button>
              </div>
            </div>

            {/* Scope Segmented Control */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                Splicing Scope
                <HelpCircle className="h-3 w-3 text-muted-foreground/45" />
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-muted-foreground/10">
                <button
                  type="button"
                  onClick={() => setScope('single')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                    scope === 'single'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  Single Step
                </button>
                <button
                  type="button"
                  onClick={() => setScope('subtree')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                    scope === 'subtree'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Entire Branch
                </button>
              </div>
            </div>

            {/* Gap Healing Toggle Option (only relevant on Move) */}
            {action === 'move' && (
              <div
                onClick={() => setHealGap(!healGap)}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-border/40 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors duration-200"
              >
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-semibold text-foreground">Auto-heal original path</p>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Bridge the node's original parent and child steps together to prevent path disruption.
                  </p>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                    healGap ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-md ring-0 transition duration-250 ease-in-out ${
                      healGap ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/10 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="rounded-xl text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-transform"
          >
            Reconcile Graph
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReconcileDropDialog;
