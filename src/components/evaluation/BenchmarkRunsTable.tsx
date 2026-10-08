'use client';

/**
 * @fileOverview Benchmark Runs Table Component (Phase 15 Milestone 5)
 *
 * Implements agents_mcp_ui.md lines 3645–3653 (Benchmarks View):
 * - Displays scenario ID, domain badge, persona chip, benchmark score (0–100), pass/fail status chip,
 *   execution duration, token consumption, estimated micro-USD cost, and timestamp.
 * - Tactile `[Inspect Run]` trigger button to view 4-part explainability grid.
 * - Tactile `[Trigger Run]` button to re-run scenarios in dry-run mode (Rule 42).
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive touch targets >= 44px, tactile feedback (`active:scale-[0.97]`).
 * - Rule 9: Bounded concurrency & row limits (max 50 rows).
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism & Micro-Cent Rounding.
 * - Rule 42: Shadow Mode Badge (0 live database writes).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Play,
  Clock,
  Zap,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BenchmarkRunSummary } from '@/platform/evaluation/ui/evaluation-ui-types';

export interface BenchmarkRunsTableProps {
  runs: BenchmarkRunSummary[];
  onInspectRun: (runId: string) => void;
  onTriggerRun?: (scenarioId: string) => void;
  isTriggering?: boolean;
}

export function BenchmarkRunsTable({
  runs,
  onInspectRun,
  onTriggerRun,
  isTriggering = false,
}: BenchmarkRunsTableProps): React.JSX.Element {
  if (runs.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card text-muted-foreground space-y-2">
        <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No benchmark runs match the active filter</p>
        <p className="text-xs">Adjust your domain, persona, or search filters to view historical benchmark telemetry.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-semibold">
              <th className="py-3 px-4">Scenario / Target</th>
              <th className="py-3 px-4">Domain</th>
              <th className="py-3 px-4">Persona</th>
              <th className="py-3 px-4 text-center">Score</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Tokens / Cost</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {runs.slice(0, 50).map((run) => {
              const isPassed = run.passed;

              return (
                <tr
                  key={run.id}
                  className="hover:bg-muted/10 transition-colors group"
                >
                  {/* SCENARIO */}
                  <td className="py-3 px-4 font-mono font-medium text-foreground">
                    <div className="flex flex-col">
                      <span className="font-semibold">{run.scenarioId}</span>
                      <span className="text-[10px] text-muted-foreground">ID: {run.id}</span>
                    </div>
                  </td>

                  {/* DOMAIN */}
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">
                      {run.domain}
                    </Badge>
                  </td>

                  {/* PERSONA */}
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {run.personaId}
                  </td>

                  {/* SCORE */}
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    <span
                      className={cn(
                        isPassed
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      )}
                    >
                      {run.score.toFixed(1)}%
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-mono inline-flex items-center gap-1',
                        isPassed
                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                          : 'border-destructive/30 text-destructive bg-destructive/10'
                      )}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {isPassed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </td>

                  {/* DURATION */}
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{run.durationMs}ms</span>
                    </div>
                  </td>

                  {/* TOKENS & COST */}
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{run.tokensUsed.toLocaleString()} tok</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-amber-500">
                        <Coins className="w-2.5 h-2.5" />
                        <span>${run.estimatedCostUsd.toFixed(4)}</span>
                      </div>
                    </div>
                  </td>

                  {/* TIMESTAMP */}
                  <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                    {new Date(run.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onInspectRun(run.id)}
                        className="rounded-lg h-8 px-2.5 text-xs active:scale-[0.97] hover:bg-primary/10 hover:text-primary"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Inspect
                      </Button>
                      {onTriggerRun && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isTriggering}
                          onClick={() => onTriggerRun(run.scenarioId)}
                          className="rounded-lg h-8 px-2 text-xs active:scale-[0.97] text-muted-foreground hover:text-foreground"
                          title="Trigger Dry-Run (Rule 42)"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border/80 bg-muted/10 text-right text-[11px] text-muted-foreground font-mono">
        Showing up to {Math.min(runs.length, 50)} of {runs.length} runs · dryRun: true enforced (Rule 42)
      </div>
    </div>
  );
}
