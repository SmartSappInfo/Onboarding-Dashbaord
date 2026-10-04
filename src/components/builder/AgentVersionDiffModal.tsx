'use client';

/**
 * @fileOverview Agent Version Diff Modal (Phase 8 Milestone 5 Task 4)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px] sm:min-h-[56px]
 * - Zero Raw Descriptions: routed exclusively through `<CardInfoTooltip text="..." />`
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Rules:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 12: Risk level escalation detection and visual alerts.
 * - Rule 23: Budget ceiling increase warnings.
 * - Rule 65: Canary Releases & Staging Drafts SemVer diff comparisons.
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitCompare,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import type { AgentVersionDiff } from '@/platform/ui/builder/agent-builder-types';

export interface AgentVersionDiffModalProps {
  diff: AgentVersionDiff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmPublish?: () => void;
  isPublishing?: boolean;
}

export function AgentVersionDiffModal({
  diff,
  open,
  onOpenChange,
  onConfirmPublish,
  isPublishing = false,
}: AgentVersionDiffModalProps) {
  if (!diff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden">
        {/* 1. Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Version Diff: {diff.personaName}
            </DialogTitle>
            <CardInfoTooltip text="Inspect configuration changes between draft and published versions before promoting to production." />
          </div>
          <DialogDescription className="sr-only">
            Side-by-side comparison of agent configuration differences between versions.
          </DialogDescription>
        </DialogHeader>

        {/* 2. Modal Body */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-4">
          {/* Version Header Indicator */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                v{diff.previousVersion}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="default" className="font-mono text-xs">
                v{diff.targetVersion}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">ID: {diff.personaId}</span>
          </div>

          {/* Risk Escalation Warning Banner (Rule 12) */}
          {diff.riskEscalated && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Risk Ceiling Escalation
                </span>
                <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                  This version escalates autonomous risk to Level 3 or 4 (Financial or Privileged operations).
                  Mandatory human approval gates will be strictly enforced during execution.
                </p>
              </div>
            </div>
          )}

          {/* Budget Increase Banner (Rule 23) */}
          {diff.budgetIncreased && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Resource Budget Increased
                </span>
                <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                  Token limit, tool call ceiling, or maximum cost budget was increased. Check runtime ceilings to avoid overrun.
                </p>
              </div>
            </div>
          )}

          {/* Field Changes Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Modified Configuration Fields ({diff.fieldChanges.length})
            </h4>

            {diff.fieldChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 mb-2" />
                <p className="font-medium text-foreground">Zero Configuration Drift</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  The current draft matches the published version specifications.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/80 overflow-hidden divide-y divide-border/60">
                {diff.fieldChanges.map((change, idx) => (
                  <div key={idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/10">
                    <div>
                      <span className="font-semibold text-foreground">{change.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground ml-2">({change.field})</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="line-through text-rose-500/80 bg-rose-500/10 px-2 py-0.5 rounded">
                        {typeof change.oldValue === 'object'
                          ? JSON.stringify(change.oldValue)
                          : String(change.oldValue ?? 'None')}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">
                        {typeof change.newValue === 'object'
                          ? JSON.stringify(change.newValue)
                          : String(change.newValue ?? 'None')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Demarcated Footer (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            variant="outline"
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          {onConfirmPublish && (
            <Button
              className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-medium"
              onClick={onConfirmPublish}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Promote & Publish Release'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
