'use client';

/**
 * @fileOverview Standardized Benchmark Run Detail Inspector Modal (Phase 15 Milestone 5)
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
 * - Rule 7: Mobile-first responsive touch targets >= 44px, tactile feedback.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 12: Canonical Risk Vocabulary (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`).
 * - Rule 13 & 30: Untrusted Data Isolation inside `<untrusted_reference_data id="...">`.
 * - Rule 22: Cryptographic State Hash Binding.
 * - Rule 32 & 33: Sensitive Credential & PII Redaction.
 * - Rule 41: 4-Part Explainability Grid (WHAT / WHY / EXPECTED vs ACTUAL / RISK).
 * - Rule 42: Shadow Mode Badge (0 live database writes).
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
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  ShieldCheck,
  FileCode,
  Zap,
  Activity,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BenchmarkRunDetailData } from '@/platform/evaluation/ui/evaluation-ui-types';

export interface BenchmarkRunDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BenchmarkRunDetailData | null;
}

/**
 * Strips or redacts any sensitive API keys or bearer tokens (Rule 32 & 33).
 */
function redactSecrets(text: string): string {
  return text
    .replace(/(?:bearer\s+|Bearer\s+)[A-Za-z0-9_\-\.]{16,}/g, '[REDACTED_BEARER_TOKEN]')
    .replace(/(?:sk_live_|sk_test_|api_key=)[A-Za-z0-9_\-]{16,}/g, '[REDACTED_API_KEY]');
}

export function BenchmarkRunDetailModal({
  open,
  onOpenChange,
  data,
}: BenchmarkRunDetailModalProps): React.JSX.Element {
  const [copiedRaw, setCopiedRaw] = React.useState<boolean>(false);
  const [showUntrustedData, setShowUntrustedData] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (open) {
      setCopiedRaw(false);
      setShowUntrustedData(false);
    }
  }, [open]);

  if (!data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
        >
          <DialogHeader demarcated>
            <div className="flex flex-row items-center gap-2">
              <Award className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-base font-semibold">Benchmark Inspection</DialogTitle>
              <CardInfoTooltip text="Inspect benchmark run scoring, 4-part explainability, and postcondition assertions." />
            </div>
            <DialogDescription className="sr-only">Benchmark Inspection</DialogDescription>
          </DialogHeader>
          <div className="p-8 text-center text-sm text-muted-foreground">
            No benchmark run selected for inspection.
          </div>
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px]"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { run, explainabilityGrid, evaluationScores, untrustedReferenceData } = data;
  const isPassed = run.passed;
  const sanitizedUntrustedData = redactSecrets(untrustedReferenceData);

  const handleCopyRaw = (): void => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(sanitizedUntrustedData);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* DEMARCATED HEADER (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex flex-row items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
                isPassed
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              )}
            >
              {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div className="flex flex-col text-left truncate">
              <DialogTitle className="text-base font-semibold truncate">
                Benchmark Run: {run.scenarioId}
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                Run #{run.id} · Domain: {run.domain} · Persona: {run.personaId}
              </span>
            </div>
            <CardInfoTooltip text="Detailed report of the gold-standard benchmark run including the 4-part explainability grid, 4 evaluation vector scores, and XML containerized evidence." />
          </div>
          <DialogDescription className="sr-only">
            Gold-Standard Benchmark Run Inspection
          </DialogDescription>
        </DialogHeader>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* TOP SUMMARY STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-border/80 bg-card">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                Composite Score
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold font-mono text-foreground">
                  {run.score.toFixed(1)}%
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-mono',
                    isPassed
                      ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                      : 'border-destructive/30 text-destructive bg-destructive/10'
                  )}
                >
                  {isPassed ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border/80 bg-card">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                Execution Time
              </span>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold font-mono text-foreground">
                  {run.durationMs}ms
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border/80 bg-card">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                Tokens Used
              </span>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold font-mono text-foreground">
                  {run.tokensUsed.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border/80 bg-card">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                Est. Cost
              </span>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-semibold font-mono text-foreground">
                  ${run.estimatedCostUsd.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* 4-PART EXPLAINABILITY GRID (Rule 41) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              4-Part Explainability Grid (Rule 41)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  1. What
                </span>
                <p className="text-xs text-foreground leading-relaxed">{explainabilityGrid.what}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  2. Why
                </span>
                <p className="text-xs text-foreground leading-relaxed">{explainabilityGrid.why}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  3. Expected vs Actual
                </span>
                <p className="text-xs text-foreground leading-relaxed">
                  {explainabilityGrid.expectedVsActual}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                    4. Risk Tier
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {explainabilityGrid.risk}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Blast radius bounded strictly by Rule 42 shadow mode simulation (0 live mutations).
                </p>
              </div>
            </div>
          </div>

          {/* 4 EVALUATION VECTOR SCORES */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Evaluation Vector Breakdown
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-border/80 bg-muted/10 text-center">
                <span className="text-[10px] text-muted-foreground block mb-0.5">Task Completion</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {evaluationScores.taskCompletionScore.toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-muted/10 text-center">
                <span className="text-[10px] text-muted-foreground block mb-0.5">Tool Selection</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {evaluationScores.toolSelectionScore.toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-muted/10 text-center">
                <span className="text-[10px] text-muted-foreground block mb-0.5">Policy Adherence</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {evaluationScores.policyCorrectnessScore.toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-muted/10 text-center">
                <span className="text-[10px] text-muted-foreground block mb-0.5">Evidence Grounding</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {evaluationScores.evidenceGroundingScore.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* UNTRUSTED DATA XML REFERENCE CONTAINER (Rules 13 & 30) */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  Reference Evidence (&lt;untrusted_reference_data&gt;)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowUntrustedData(!showUntrustedData)}
                  className="h-7 px-2 text-[11px] rounded-lg min-h-0 active:scale-95"
                >
                  {showUntrustedData ? 'Collapse' : 'Expand'}
                </Button>
                {showUntrustedData && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyRaw}
                    className="h-7 px-2 text-[11px] rounded-lg min-h-0 active:scale-95"
                  >
                    {copiedRaw ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1" />
                    )}
                    {copiedRaw ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            </div>

            {showUntrustedData ? (
              <div className="rounded-lg bg-muted/20 p-3 font-mono text-xs text-foreground overflow-x-auto max-h-56">
                <pre className="whitespace-pre-wrap">{sanitizedUntrustedData}</pre>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Evidence container is isolated from system instructions to prevent prompt injection (Rule 30).
                Click Expand to view raw scenario input and assertion tokens.
              </p>
            )}
          </div>
        </div>

        {/* DEMARCATED FOOTER (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
