'use client';

/**
 * @fileOverview AI Impact Simulation & Approval Drawer (Phase 9)
 *
 * Slide-over drawer presenting the pre-computed blast radius, affected members,
 * before vs after diffs, and the human-in-the-loop approval trigger.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingDown,
  Users,
  Layers,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import type { AiAdminActionProposal, BlastRadiusLevel } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AiImpactPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: AiAdminActionProposal | null;
  onApprove: (proposal: AiAdminActionProposal) => Promise<void>;
  onReject: (proposal: AiAdminActionProposal) => Promise<void>;
}

export function AiImpactPreviewDrawer({
  isOpen,
  onClose,
  proposal,
  onApprove,
  onReject,
}: AiImpactPreviewDrawerProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!proposal) return null;

  const handleApproveClick = async () => {
    setIsProcessing(true);
    try {
      await onApprove(proposal);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectClick = async () => {
    setIsProcessing(true);
    try {
      await onReject(proposal);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const blastRadiusBadge = (level: BlastRadiusLevel) => {
    switch (level) {
      case 'critical':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px] font-bold uppercase tracking-wider">
            <Flame className="w-3 h-3" /> Critical Blast Radius
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="outline" className="gap-1 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border-rose-500/30">
            <ShieldAlert className="w-3 h-3" /> High Impact
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Moderate Impact
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Scoped / Low Impact
          </Badge>
        );
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col justify-between bg-card border-l shadow-2xl z-[100]"
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header Card */}
          <div className="p-5 pb-4 border-b bg-muted/20 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {blastRadiusBadge(proposal.impactPreview.blastRadius)}
              <Badge variant="secondary" className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                <TrendingDown className="w-3 h-3 mr-1 inline" /> Risk Delta: {proposal.impactPreview.riskScoreDelta} pts
              </Badge>
            </div>

            <SheetTitle className="text-base font-bold text-foreground">
              {proposal.title}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Prompt: &ldquo;{proposal.naturalLanguagePrompt}&rdquo;
            </SheetDescription>
          </div>

          <div className="p-5 space-y-5 text-xs">
            {/* Impact Metric Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-muted/30 border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Affected Users</span>
                <span className="text-base font-black text-foreground">
                  {proposal.impactPreview.affectedUserCount}
                </span>
              </div>
              <div className="p-3 bg-muted/30 border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Roles Scoped</span>
                <span className="text-base font-black text-foreground">
                  {proposal.impactPreview.affectedRoleCount}
                </span>
              </div>
              <div className="p-3 bg-muted/30 border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Entities Touched</span>
                <span className="text-base font-black text-foreground">
                  {proposal.impactPreview.affectedEntityCount}
                </span>
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-foreground">Action Summary</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{proposal.explanation}</p>
            </div>

            {/* Changes Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">Simulated Execution Steps</h4>
              <div className="p-3 bg-muted/20 border rounded-lg space-y-1.5">
                {proposal.impactPreview.changesSummary.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Before vs After Diff Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">State Transition Diff</h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-rose-600 font-bold uppercase block">Before Execution</span>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(proposal.impactPreview.diffBefore, null, 2)}
                  </pre>
                </div>
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-1">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">After Execution</span>
                  <pre className="text-[10px] text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                    {JSON.stringify(proposal.impactPreview.diffAfter, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {proposal.requiresDualApproval && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">
                  Dual-Admin Approval Required
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Because of the critical blast radius of this action, execution requires validation from two independent workspace administrators.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <SheetFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRejectClick}
            disabled={isProcessing}
            className="text-xs h-9 px-3 text-muted-foreground active:scale-[0.97]"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject Proposal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApproveClick}
            disabled={isProcessing}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Executing Action...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve & Execute
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AiImpactPreviewDrawer;
