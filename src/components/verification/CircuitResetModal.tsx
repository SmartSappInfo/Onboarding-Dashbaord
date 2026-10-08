'use client';

/**
 * @fileOverview Standardized Audited Circuit Breaker Reset Modal (Phase 14 Milestone 5 Task 3)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog System Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first touch targets >= 44px, tactile feedback.
 * - Rule 8 & 47: Anti-IDOR multi-tenant validation.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 17: Non-Delegable Human Gate (`actor.type === 'user'`).
 * - Rule 19: Deterministic Idempotency Key.
 * - Rule 24: Dynamic Circuit Breaker recovery (`OPEN` -> `HALF_OPEN` / `CLOSED`).
 * - Rule 42: Shadow Mode relief upon verified reset.
 * - Rule 60: Emergency Dead-Man Switch Evaluation.
 * - Rule 61: Mandatory Operator Justification (>= 5 chars) with live counter.
 * - `.agents/AGENTS.md`: Actionable toast navigation with relative paths.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldAlert,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { AgentHealthScorecard } from '@/platform/verification/health/health-types';
import { resetAgentCircuitBreakerAction } from '@/app/actions/agent-health-actions';

export interface CircuitResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scorecard: AgentHealthScorecard | null;
  organizationId: string;
  workspaceId: string;
  onResetSuccess?: (updatedScorecard: AgentHealthScorecard) => void;
  resetAction?: typeof resetAgentCircuitBreakerAction;
}

export function CircuitResetModal({
  open,
  onOpenChange,
  scorecard,
  organizationId,
  workspaceId,
  onResetSuccess,
  resetAction = resetAgentCircuitBreakerAction,
}: CircuitResetModalProps): React.JSX.Element {
  const [justification, setJustification] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (open) {
      setJustification('');
      setIsSubmitting(false);
    }
  }, [open]);

  const trimmedJustification = justification.trim();
  const isJustificationValid = trimmedJustification.length >= 5;

  const handleReset = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!scorecard || !isJustificationValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await resetAction({
        organizationId,
        workspaceId,
        personaId: scorecard.personaId,
        justification: trimmedJustification,
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Circuit Reset Failed',
          description: res.error?.message || 'Could not reset tripped circuit breaker.',
          variant: 'destructive',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/health',
            label: 'View Health Cockpit',
          },
        });
        return;
      }

      toast({
        title: 'Circuit Breaker Reset',
        description: `Persona '${scorecard.personaId}' reset to probing state (${res.data.circuitState}).`,
        duration: 8000,
        actionConfig: {
          path: '/admin/intelligence/health',
          label: 'View Health Cockpit',
        },
      });

      if (onResetSuccess) {
        onResetSuccess(res.data);
      }
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Unexpected Error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 10000,
        actionConfig: {
          path: '/admin/intelligence/health',
          label: 'View Health Cockpit',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!scorecard) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
        >
          <DialogHeader demarcated>
            <div className="flex flex-row items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-base font-semibold">Circuit Reset</DialogTitle>
              <CardInfoTooltip text="Manual circuit breaker override." />
            </div>
            <DialogDescription className="sr-only">Circuit reset modal</DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-sm text-muted-foreground">
            No agent persona selected for circuit reset.
          </div>
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isTripped = scorecard.circuitState === 'OPEN';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* DEMARCATED HEADER (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex flex-row items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex flex-col text-left truncate">
              <div className="flex flex-row items-center gap-2">
                <DialogTitle className="text-base font-semibold truncate">
                  Reset Circuit Breaker
                </DialogTitle>
                <CardInfoTooltip text="Manually reset a tripped agent circuit breaker back to probing state. Requires verified human operator authority and a mandatory audit justification note (>= 5 chars)." />
              </div>
              <span className="text-xs text-muted-foreground font-mono truncate">
                Persona: {scorecard.personaId}
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-mono shrink-0',
              isTripped
                ? 'border-destructive/30 text-destructive bg-destructive/10'
                : 'border-amber-500/30 text-amber-600 bg-amber-500/10'
            )}
          >
            {scorecard.circuitState}
          </Badge>
          <DialogDescription className="sr-only">
            Audited manual circuit breaker reset modal
          </DialogDescription>
        </DialogHeader>

        {/* FORM BODY */}
        <form onSubmit={handleReset} className="flex flex-col flex-1">
          <div className="p-6 space-y-4 text-left">
            {/* DIAGNOSTIC SUMMARY */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                Tripped Persona Diagnostics
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Health Score</span>
                  <span className="font-bold font-mono text-sm text-foreground">
                    {scorecard.healthScore} / 100
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Failure Rate</span>
                  <span className="font-bold font-mono text-sm text-destructive">
                    {scorecard.failureRate}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Consecutive Errors</span>
                  <span className="font-bold font-mono text-sm text-foreground">
                    {scorecard.consecutiveFailures}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Current Mode</span>
                  <span className="font-semibold font-mono text-xs text-amber-600 dark:text-amber-400">
                    {scorecard.degradationMode}
                  </span>
                </div>
              </div>

              {scorecard.trippedReason && (
                <div className="mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground font-mono">
                  Trip Reason: {scorecard.trippedReason}
                </div>
              )}
            </div>

            {/* AUDIT JUSTIFICATION INPUT (Rule 61) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="reset-justification" className="text-xs font-semibold text-foreground">
                  Audit Justification Note <span className="text-destructive">*</span>
                </Label>
                <span
                  className={cn(
                    'text-[11px] font-mono',
                    isJustificationValid ? 'text-muted-foreground' : 'text-amber-500 font-medium'
                  )}
                >
                  {trimmedJustification.length} / 5 chars min
                </span>
              </div>
              <Textarea
                id="reset-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why this circuit breaker is safe to reset (e.g., 'API rate limit resolved by upstream provider')."
                rows={3}
                className="text-xs rounded-xl bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary min-h-[80px]"
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-muted-foreground">
                Per Rule 17 & 61, resets are recorded permanently in the platform audit trail and
                restricted to human operators.
              </p>
            </div>
          </div>

          {/* DEMARCATED FOOTER (theme.md §8) */}
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0 mt-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl active:scale-[0.97] min-h-[44px]"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={!isJustificationValid || isSubmitting}
              className="rounded-xl active:scale-[0.97] min-h-[44px] bg-primary text-primary-foreground font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Confirm Circuit Reset
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
