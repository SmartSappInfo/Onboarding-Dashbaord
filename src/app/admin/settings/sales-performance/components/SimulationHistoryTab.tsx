'use client';

/**
 * @fileoverview Pre-Publish Simulation & Version History Tab for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 86 & UI Section 65 / 3085 Critical Requirements:
 * 1. Simulation Sandbox: Tests proposed policy changes against recent 30-day workspace activity.
 * 2. Projected Impact: Rep-by-rep score deltas, rank shifts, distribution shifts, and warning alerts.
 * 3. Immutable Version History: Complete audit trail of all published policy versions with one-click rollback.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Controls enforce >= 44px touch envelopes.
 * - Micro-interactions use active:scale-[0.97].
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Sparkles,
  Play,
  History,
  RotateCcw,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
} from 'lucide-react';
import type {
  PolicySimulationResult,
  PolicyVersionRecord,
} from '@/lib/policy-studio/types';

interface SimulationHistoryTabProps {
  simulationResult: PolicySimulationResult | null;
  isSimulating: boolean;
  onRunSimulation: () => void;
  versions: PolicyVersionRecord[];
  isLoadingVersions: boolean;
  onRollbackVersion: (versionNumber: number) => void;
}

export function SimulationHistoryTab({
  simulationResult,
  isSimulating,
  onRunSimulation,
  versions,
  isLoadingVersions,
  onRollbackVersion,
}: SimulationHistoryTabProps) {
  return (
    <div className="space-y-8 max-w-5xl text-left">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Section 1: Pre-Publish Impact Simulation Sandbox */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Pre-Publish Impact Simulation
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Test proposed scoring weights and anti-gaming rules against your workspace&apos;s real 30-day activity data before committing changes.
            </p>
          </div>

          <Button
            type="button"
            onClick={onRunSimulation}
            disabled={isSimulating}
            className="min-h-[44px] px-5 rounded-xl font-bold bg-primary text-primary-foreground shadow-md active:scale-[0.97] transition-all shrink-0"
          >
            {isSimulating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {simulationResult ? 'Re-run Simulation' : 'Simulate Policy Impact'}
          </Button>
        </div>

        {/* Simulation Output */}
        {simulationResult ? (
          <div className="space-y-4 pt-2">
            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3.5 rounded-xl border bg-card/60 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reps Affected
                </span>
                <p className="text-xl font-mono font-black text-foreground">
                  {simulationResult.repsAffectedCount} of {simulationResult.repsCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Scores would shift</p>
              </Card>

              <Card className="p-3.5 rounded-xl border bg-card/60 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Avg Score Delta
                </span>
                <p
                  className={`text-xl font-mono font-black ${
                    simulationResult.averageScoreDeltaPercent > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : simulationResult.averageScoreDeltaPercent < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-foreground'
                  }`}
                >
                  {simulationResult.averageScoreDeltaPercent > 0 ? '+' : ''}
                  {simulationResult.averageScoreDeltaPercent}%
                </p>
                <p className="text-[10px] text-muted-foreground">Team composite shift</p>
              </Card>

              <Card className="p-3.5 rounded-xl border bg-card/60 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Anti-Gaming Caps
                </span>
                <p className="text-xl font-mono font-black text-amber-600 dark:text-amber-400">
                  {simulationResult.antiGamingInterventionsCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Excess events damped</p>
              </Card>

              <Card className="p-3.5 rounded-xl border bg-card/60 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Median Composite
                </span>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-sm font-semibold text-muted-foreground line-through">
                    {simulationResult.distribution.current.median}
                  </span>
                  <span className="text-xl font-black text-foreground">
                    &rarr; {simulationResult.distribution.projected.median}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Distribution midpoint</p>
              </Card>
            </div>

            {/* Warnings & Anomalies */}
            {simulationResult.warnings && simulationResult.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Potential Policy Anomalies Detected</span>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground pl-5 list-disc">
                  {simulationResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rep-by-Rep Impact Table */}
            <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/15">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Representative</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Current Score</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Projected Score</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Score Delta</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Rank Shift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulationResult.reps.map((rep) => (
                    <TableRow key={rep.userId} className="hover:bg-muted/20">
                      <TableCell className="font-semibold text-xs py-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">{rep.userName}</p>
                          <p className="text-[10px] text-muted-foreground">{rep.userEmail}</p>
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs font-bold py-3">
                        {rep.currentScore}
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs font-black text-primary py-3">
                        {rep.projectedScore}
                      </TableCell>

                      <TableCell className="text-center py-3">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] font-bold ${
                            rep.scoreDelta > 0
                              ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                              : rep.scoreDelta < 0
                              ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                              : 'text-muted-foreground bg-muted/40'
                          }`}
                        >
                          {rep.scoreDelta > 0 ? '+' : ''}
                          {rep.scoreDelta} ({rep.scoreDeltaPercent > 0 ? '+' : ''}
                          {rep.scoreDeltaPercent}%)
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center py-3">
                        <div className="flex items-center justify-center gap-1 text-xs font-bold">
                          {rep.rankDelta > 0 ? (
                            <span className="text-emerald-600 flex items-center">
                              <ArrowUpRight className="h-3.5 w-3.5" /> +{rep.rankDelta}
                            </span>
                          ) : rep.rankDelta < 0 ? (
                            <span className="text-rose-600 flex items-center">
                              <ArrowDownRight className="h-3.5 w-3.5" /> {rep.rankDelta}
                            </span>
                          ) : (
                            <span className="text-muted-foreground flex items-center">
                              <Minus className="h-3.5 w-3.5" /> 0
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : (
          <Card className="rounded-2xl border bg-card/40 p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Simulation Sandbox Ready
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Click &quot;Simulate Policy Impact&quot; above to preview how your customized rules and dimension weights would affect representative scorecards.
            </p>
          </Card>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Section 2: Policy Version Audit History & Rollback */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-bold text-foreground">
              Policy Version History & Audit Trail
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Every published change creates an immutable snapshot. You can safely roll back to any previous version.
          </p>
        </div>

        {isLoadingVersions ? (
          <div className="py-8 text-center text-xs text-muted-foreground font-semibold">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2 text-primary" />
            Loading version history...
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No historical versions recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {versions.map((ver, idx) => {
              const isCurrent = idx === 0;
              const formattedDate = new Date(ver.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card
                  key={ver.id}
                  className={`rounded-2xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-card/60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={isCurrent ? 'default' : 'outline'}
                        className="font-mono text-xs font-bold"
                      >
                        v{ver.version} {isCurrent ? '• Active' : ''}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formattedDate}</span>
                      <span className="text-xs text-muted-foreground">by {ver.authorName}</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">{ver.changeSummary}</p>
                  </div>

                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRollbackVersion(ver.version)}
                      className="min-h-[38px] text-xs font-semibold rounded-xl text-primary border-primary/20 hover:bg-primary/10 active:scale-[0.97] shrink-0 self-end sm:self-auto"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rollback to v{ver.version}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
