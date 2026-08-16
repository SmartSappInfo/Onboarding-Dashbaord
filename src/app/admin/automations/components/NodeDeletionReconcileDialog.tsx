'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2, ShieldAlert, Sparkles, StopCircle, Zap } from 'lucide-react';
import type { ParkedContactStrategy } from '@/lib/automations/node-deletion-reconciliation';
import { cn } from '@/lib/utils';

interface NodeDeletionReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeLabel: string;
  parkedCount: number;
  onConfirm: (strategy: ParkedContactStrategy) => Promise<void>;
}

export function NodeDeletionReconcileDialog({
  open,
  onOpenChange,
  nodeLabel,
  parkedCount,
  onConfirm,
}: NodeDeletionReconcileDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = React.useState<ParkedContactStrategy>('advance_now');
  const [step, setStep] = React.useState<'selection' | 'confirmation'>('selection');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset dialog state when opened
  React.useEffect(() => {
    if (open) {
      setSelectedStrategy('advance_now');
      setStep('selection');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleProceedToConfirmation = () => {
    setStep('confirmation');
  };

  const handleFinalConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(selectedStrategy);
    } finally {
      setIsSubmitting(false);
    }
  };

  const strategyTitles: Record<ParkedContactStrategy, string> = {
    advance_now: 'Release & Advance Immediately',
    fulfill_schedule: 'Fulfill Schedule & Pre-Route',
    cancel_runs: 'Cancel Parked Automation Runs',
  };

  const strategyDescriptions: Record<ParkedContactStrategy, string> = {
    advance_now: `Cancel remaining wait times and immediately advance all ${parkedCount} contact(s) to the next step.`,
    fulfill_schedule: `Keep scheduled wait timers running as planned. When each timer expires, contacts will automatically move to the next step.`,
    cancel_runs: `Stop and terminate the active automation runs for all ${parkedCount} contact(s) currently parked at this node.`,
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-xl w-[95vw] rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl overflow-hidden focus:outline-none">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'p-2 rounded-xl text-white',
                step === 'confirmation' ? 'bg-amber-500 animate-pulse' : 'bg-primary'
              )}>
                {step === 'confirmation' ? <ShieldAlert className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                {step === 'selection'
                  ? `Parked Contacts Action Required (${parkedCount})`
                  : `Double Confirmation: ${strategyTitles[selectedStrategy]}`}
              </DialogTitle>
            </div>
            <Badge variant="secondary" className="font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 px-3 py-1 text-xs">
              {parkedCount} Parked Contact{parkedCount === 1 ? '' : 's'}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-medium leading-relaxed">
            {step === 'selection'
              ? `The node "${nodeLabel}" currently holds ${parkedCount} contact(s) in a wait state. Please choose what happens to them when this node is deleted.`
              : `Please double-check and confirm the strategy to apply to all ${parkedCount} parked contact(s) before deleting "${nodeLabel}".`}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: STRATEGY SELECTION VIEW */}
        {step === 'selection' ? (
          <div className="space-y-3 my-4">
            {/* Strategy 1: Advance Immediately */}
            <div
              onClick={() => setSelectedStrategy('advance_now')}
              className={cn(
                'p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 text-left',
                selectedStrategy === 'advance_now'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                  Release & Advance Immediately
                  {selectedStrategy === 'advance_now' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed font-medium">
                  {strategyDescriptions.advance_now}
                </p>
              </div>
            </div>

            {/* Strategy 2: Fulfill Schedule & Pre-Route */}
            <div
              onClick={() => setSelectedStrategy('fulfill_schedule')}
              className={cn(
                'p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 text-left',
                selectedStrategy === 'fulfill_schedule'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg shrink-0 mt-0.5">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                  Fulfill Schedule & Pre-Route to Next Step
                  {selectedStrategy === 'fulfill_schedule' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed font-medium">
                  {strategyDescriptions.fulfill_schedule}
                </p>
              </div>
            </div>

            {/* Strategy 3: Cancel Parked Runs */}
            <div
              onClick={() => setSelectedStrategy('cancel_runs')}
              className={cn(
                'p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 text-left',
                selectedStrategy === 'cancel_runs'
                  ? 'border-destructive bg-destructive/5 ring-2 ring-destructive/20 shadow-sm'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg shrink-0 mt-0.5">
                <StopCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                  Cancel Parked Automation Runs
                  {selectedStrategy === 'cancel_runs' && <CheckCircle2 className="h-4 w-4 text-destructive" />}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed font-medium">
                  {strategyDescriptions.cancel_runs}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: DOUBLE CONFIRMATION VIEW */
          <div className="my-4 space-y-4 text-left">
            <div className={cn(
              'p-4 rounded-2xl border flex items-start gap-3',
              selectedStrategy === 'cancel_runs'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
            )}>
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold">Important Confirmation Warning</h4>
                <p className="text-[11px] font-medium leading-relaxed">
                  You have selected <span className="font-bold underline">{strategyTitles[selectedStrategy]}</span>.
                  {strategyDescriptions[selectedStrategy]}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-1 text-xs">
              <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider">Target Node:</span>
              <p className="font-semibold text-foreground">{nodeLabel}</p>
              <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider block mt-2">Impacted Records:</span>
              <p className="font-semibold text-foreground">{parkedCount} active contact run(s)</p>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="pt-3 flex items-center justify-between border-t border-border mt-2">
          {step === 'selection' ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-xl font-bold h-11 min-h-[44px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-transparent px-4 active:scale-[0.97] transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToConfirmation}
                className="rounded-xl font-bold h-11 min-h-[44px] text-xs bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.97] transition-all flex items-center gap-1.5 px-5"
              >
                Continue to Double Confirmation
                <Sparkles className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('selection')}
                disabled={isSubmitting}
                className="rounded-xl font-bold h-11 min-h-[44px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-transparent px-4 active:scale-[0.97] transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Selection
              </Button>
              <Button
                onClick={handleFinalConfirm}
                disabled={isSubmitting}
                className={cn(
                  'rounded-xl font-bold h-11 min-h-[44px] text-xs text-white disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] transition-all flex items-center gap-1.5 px-5',
                  selectedStrategy === 'cancel_runs' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/95'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Applying Strategy & Deleting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Strategy & Delete Node
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
