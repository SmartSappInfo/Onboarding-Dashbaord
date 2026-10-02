'use client';

/**
 * @fileOverview Emergency Dead-Man Switch Governance Banner (Phase 3 Milestone 4 - Task 2)
 *
 * Implements Rule 60 (Emergency Dead-Man Controls), Rule 61 (Backoffice Control Plane),
 * and theme.md Section 8 (Standardized Modal Architecture).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { ShieldAlert, ShieldCheck, AlertOctagon, Loader2 } from 'lucide-react';

export interface EmergencyPauseBannerProps {
  isPaused: boolean;
  onTogglePause: (pause: boolean, reason?: string) => Promise<void>;
  isSystemAdmin?: boolean;
}

export function EmergencyPauseBanner({
  isPaused,
  onTogglePause,
  isSystemAdmin = true,
}: EmergencyPauseBannerProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const [reason, setReason] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const handleToggle = async () => {
    setIsSubmitting(true);
    try {
      await onTogglePause(!isPaused, reason || undefined);
      setModalOpen(false);
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPaused && !isSystemAdmin) {
    return null;
  }

  return (
    <>
      {isPaused ? (
        <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 shadow-sm">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                EMERGENCY DEAD-MAN PAUSE ENGAGED
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                All autonomous agent execution and approval consumption are currently blocked platform-wide.
              </p>
            </div>
          </div>
          {isSystemAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="rounded-xl min-h-[44px] px-4 border-rose-300 dark:border-rose-800 bg-background hover:bg-rose-100/50 text-rose-800 dark:text-rose-200 font-semibold text-xs active:scale-[0.97]"
            >
              Resume Agent Operations
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-muted/15 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Agent Governance Status: <strong className="text-foreground font-semibold">Active & Monitored</strong></span>
          </div>
          {isSystemAdmin && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(true)}
              className="text-[11px] h-8 px-2.5 text-muted-foreground hover:text-rose-600 rounded-lg active:scale-[0.97]"
            >
              Emergency Kill-Switch
            </Button>
          )}
        </div>
      )}

      {/* Confirmation Dialog adhering to theme.md Section 8 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {isPaused ? 'Resume Agent Operations' : 'Engage Emergency Dead-Man Pause'}
              </DialogTitle>
              <CardInfoTooltip text="Immediately pauses all background agent step processing and approval execution without code redeployment." />
            </div>
            <DialogDescription className="sr-only">
              Confirm changing the platform emergency agent governance state.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 text-sm">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isPaused
                ? 'Resuming operations will allow pending and approved agent steps to continue executing immediately.'
                : 'Engaging the dead-man switch will instantly freeze all queued tasks, capability proposals, and tool executions across all workspaces.'}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="pause-reason" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Audit Reason
              </label>
              <input
                id="pause-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isPaused ? 'e.g. Outage resolved' : 'e.g. Investigating unexpected campaign behavior'}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isPaused ? 'default' : 'destructive'}
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isPaused ? 'Confirm Resume' : 'Engage Emergency Halt'}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
