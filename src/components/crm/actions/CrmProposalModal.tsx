'use client';

/**
 * @fileOverview Standardized CRM Action Proposal Modal (Phase 9 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture),
 * Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 12 (Risk Vocabulary: L0 to L4), Rule 19 (Deterministic Idempotency Keys),
 * Rule 21/22 (Two-Phase Action Model & SHA-256 Binding), Rule 27 (Saga Rollback Indicator),
 * Rule 41 (Explainability Grid), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * Invariants:
 * - Demarcated Header: <DialogHeader demarcated> with min-h-[52px], bg-muted/20, border-b.
 * - Single-Circle Info Tooltip: <CardInfoTooltip text="..."> at z-[10050].
 * - Zero Raw Visual Descriptions: <DialogDescription className="sr-only">.
 * - Demarcated Footer: px-6 py-3.5, border-t, bg-muted/15, with tactile rounded-xl buttons.
 * - Actionable Toast Navigation: relative path starting with single `/` (Rule: Toast Navigation).
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Database,
  ArrowRight,
} from 'lucide-react';
import type { CrmProposedAction } from '@/platform/agents/crm/actions/crm-action-types';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';
import { proposeCrmActionAction } from '@/app/actions/crm-proposal-actions';
import { useToast } from '@/hooks/use-toast';

export interface CrmProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: CrmProposedAction | null;
  onProposalSubmitted?: (proposal: ActionProposal) => void;
}

export function CrmProposalModal({
  open,
  onOpenChange,
  action,
  onProposalSubmitted,
}: CrmProposalModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);

  if (!action) {
    return null;
  }

  const handleCopyIdempotencyKey = () => {
    navigator.clipboard.writeText(action.idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await proposeCrmActionAction({
        workspaceId: action.workspaceId,
        entityId: action.entityId,
        actionData: action,
      });

      if (res.success && res.data) {
        toast({
          // M0 · T4: say exactly what happens next; nothing changes until approved AND applied.
          title: 'Sent for approval',
          description: 'Nothing changes until an approver accepts it and it is applied.',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/approvals',
            label: 'Review Approvals',
          },
        });
        onProposalSubmitted?.(res.data);
        onOpenChange(false);
      } else {
        toast({
          title: "Couldn't send for approval",
          description: res.error?.message || 'Try again.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Proposal error';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'L2_STATE_MUTATION':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'L1_INTERNAL_DRAFT':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default:
        return 'bg-muted/40 text-muted-foreground border-border/80';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        {/* Demarcated Header (theme.md Section 8.2) */}
        <DialogHeader demarcated className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold text-foreground">
                Autonomous CRM Action Proposal
              </DialogTitle>
              <CardInfoTooltip text="Two-phase review prevents unintended mutations. Mutating proposals are cryptographically bound via canonical SHA-256 hashes." />
            </div>
          </div>
          <Badge variant="outline" className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getRiskBadgeColor(action.riskLevel)}`}>
            {action.riskLevel}
          </Badge>
          <DialogDescription className="sr-only">
            Review and confirm autonomous CRM recommendation for execution or approval routing.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          {/* Section 1: Rule 41 Explainability Grid */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                WHAT
              </span>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {action.explainability.what}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                WHY (Grounded Rationale)
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {action.explainability.why}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                IMPACT
              </span>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                {action.explainability.impact}
              </p>
            </div>

            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Blast Radius:</span>
                <span>{action.explainability.blastRadius.affectedRecordsCount} record(s)</span>
                {action.explainability.blastRadius.financialExposureUsd > 0 && (
                  <span className="font-medium text-foreground">
                    • ${action.explainability.blastRadius.financialExposureUsd.toLocaleString()} exposure
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">
                  {action.explainability.blastRadius.isReversible
                    ? 'Reversible (1-click Saga Rollback)'
                    : 'Non-reversible'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Dual-Tier CRM Data Model Preservation (Rule 69) */}
          <div className="rounded-xl border border-border/70 p-3.5 bg-background space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Dual-Tier Data Model Boundary (Rule 69)
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                Master Identity Protected
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Target Operational Record:
                </span>
                <code className="text-[11px] font-mono text-foreground break-all">
                  /workspace_entities/{action.workspaceId}_{action.entityId}
                </code>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Global Identity Record (Immutable):
                </span>
                <code className="text-[11px] font-mono text-muted-foreground break-all">
                  /entities/{action.entityId}
                </code>
              </div>
            </div>
          </div>

          {/* Section 3: Reversible Saga Compensation (Rule 27) */}
          {action.compensatingCapabilityId && (
            <div className="rounded-xl border border-border/70 p-3 bg-muted/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Compensating Capability:
                </span>
                <code className="text-xs font-mono text-primary font-semibold">
                  {action.compensatingCapabilityId}
                </code>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Reverse-LIFO Rollback
              </span>
            </div>
          )}

          {/* Section 4: Cryptographic Key & Verification (Rule 19 & 22) */}
          <div className="flex items-center justify-between text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/20 border border-border/60 font-mono">
            <span className="truncate max-w-[400px]">
              Key: {action.idempotencyKey}
            </span>
            <button
              type="button"
              onClick={handleCopyIdempotencyKey}
              className="p-1 rounded hover:bg-muted text-foreground transition-colors shrink-0 ml-2"
              title="Copy Idempotency Key"
            >
              {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Section 5: Proposed Payload Delta Preview */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Payload Parameters
            </span>
            <pre className="p-3 rounded-xl border border-border/70 bg-muted/30 text-foreground font-mono text-xs overflow-x-auto max-h-36">
              {JSON.stringify(action.payload, null, 2)}
            </pre>
          </div>
        </div>

        {/* Demarcated Footer (theme.md Section 8.5) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-5 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-primary text-primary-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Submit for Approval</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
