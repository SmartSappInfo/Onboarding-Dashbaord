'use client';

/**
 * @fileOverview Approval Required Modal Notice (Phase 1 / PR-9)
 *
 * Implements Rule 21 (Two-Phase Actions), Rule 22 (Approval Binding & Burn Prevention),
 * Rule 34 (4-Level Architecture), and Workspace Modal Architecture (`theme.md` Section 8).
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
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

export interface ApprovalRequiredNoticeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvalId?: string;
  requiredLevel?: string;
  capabilityName?: string;
  approvalsPath?: string;
}

export function ApprovalRequiredNotice({
  open,
  onOpenChange,
  approvalId,
  requiredLevel = 'L3',
  capabilityName = 'This action',
  approvalsPath = '/admin/approvals',
}: ApprovalRequiredNoticeProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl"
        showCloseButton
      >
        {/* Demarcated Header (Standardized Modal Architecture) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <DialogTitle className="text-base font-semibold">
              Approval Required
            </DialogTitle>
            <CardInfoTooltip text="High-impact operations require authorized administrator approval before execution can proceed." />
          </div>
          <DialogDescription className="sr-only">
            This operation requires human approval from an authorized administrator.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm text-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Administrative Approval Pending
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {capabilityName} requires human authorization under risk policy{' '}
                <span className="font-semibold text-primary">{requiredLevel}</span>.
                Your request has been registered and awaits review.
              </p>
            </div>
          </div>

          {approvalId && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1 text-xs">
              <span className="text-muted-foreground font-medium">Approval Tracking ID:</span>
              <p className="font-mono text-xs font-semibold select-all text-foreground">
                {approvalId}
              </p>
            </div>
          )}
        </div>

        {/* Demarcated Footer (Standardized Modal Architecture) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform"
          >
            Dismiss
          </Button>

          <Button
            type="button"
            variant="default"
            asChild
            className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Link href={approvalsPath}>
              <span>View Approvals</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
