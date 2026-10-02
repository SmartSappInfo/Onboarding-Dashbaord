'use client';

/**
 * @fileOverview Standardized Rejection Reason Modal (Phase 3 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture),
 * Rule 4 (Zero any), Rule 7 (Simple English), Rule 10 (Inline Architectural Guidance),
 * Rule 40 (Audit Log Immutability), and Rule 64 (Tactile Micro-Interactions).
 *
 * Invariants:
 * - Demarcated Header: <DialogHeader demarcated> with min-h-[52px], bg-muted/20, border-b.
 * - Single-Circle Info Tooltip: <CardInfoTooltip> placed directly alongside title.
 * - Zero Visible Description Clutter: <DialogDescription className="sr-only">.
 * - Demarcated Footer: bg-muted/15, border-t, with tactile rounded-xl buttons.
 * - Strict typing: Zero `any` or `any[]`.
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
import { XCircle, Loader2 } from 'lucide-react';

export const PRESET_REJECTION_REASONS = [
  'Incorrect audience targeting',
  'Budget or cost ceiling exceeded',
  'Message copy requires revision',
  'Duplicate or redundant operation',
  'Timing or schedule conflict',
  'Custom reason',
] as const;

export type PresetRejectionReason = (typeof PRESET_REJECTION_REASONS)[number];

export interface RejectApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalTitle: string;
  onConfirmReject: (reason: string, notes?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function RejectApprovalModal({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  onConfirmReject,
  isSubmitting = false,
}: RejectApprovalModalProps) {
  const [selectedReason, setSelectedReason] = React.useState<PresetRejectionReason>(
    PRESET_REJECTION_REASONS[0]
  );
  const [notes, setNotes] = React.useState<string>('');

  const handleConfirm = async () => {
    await onConfirmReject(selectedReason, notes.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header (theme.md Section 8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <XCircle className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Reject Action Proposal
            </DialogTitle>
            <CardInfoTooltip text="Rejection feedback is recorded in the agent audit log and returned to the agent runtime for replanning." />
          </div>
          <DialogDescription className="sr-only">
            Select a rejection reason and optionally provide feedback for proposal {proposalTitle}.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Proposal to Reject
            </span>
            <span className="font-medium text-foreground text-sm line-clamp-2">
              {proposalTitle}
            </span>
            <span className="text-xs text-muted-foreground block mt-1 font-mono">
              ID: {proposalId}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Reason for Rejection
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`px-3 py-2 text-left rounded-xl text-xs font-medium border transition-all min-h-[44px] flex items-center justify-between active:scale-[0.98] ${
                    selectedReason === reason
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border/80 bg-background hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <span>{reason}</span>
                  {selectedReason === reason && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 ml-1.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="rejection-notes"
              className="text-xs font-semibold text-foreground uppercase tracking-wider block"
            >
              Operator Notes / Guidance (Optional)
            </label>
            <textarea
              id="rejection-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide specific instructions or feedback for the AI agent to replan..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Rejecting...</span>
              </>
            ) : (
              <span>Confirm Rejection</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
