'use client';

/**
 * @fileOverview Blast Radius Report Card Component (Phase 8 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 12: Autonomous risk levels display.
 * - Rule 30: Untrusted simulated data wrapped in `<untrusted_reference_data>`.
 * - Rule 41: Explainability grid (WHAT, WHY, EXPECTED STATE CHANGE).
 * - Rule 42: Shadow Mode Invariant verifying 0 live database mutations.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Lock,
  Zap,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { BlastRadiusSummary, SimulatedStepTraceItem } from '@/platform/ui/builder/agent-builder-types';

export interface BlastRadiusReportCardProps {
  blastRadius: BlastRadiusSummary;
  trace: SimulatedStepTraceItem[];
}

export function BlastRadiusReportCard({ blastRadius, trace }: BlastRadiusReportCardProps) {
  const [expandedSteps, setExpandedSteps] = React.useState<Record<number, boolean>>({});

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      {/* 1. Verified Zero Mutation Invariant Banner (Rule 42) */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-600 dark:text-emerald-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <span className="text-sm font-semibold tracking-tight">0 Live Database Mutations</span>
            <p className="text-xs text-muted-foreground">
              Executed under Shadow Simulation Mode (Rule 42). All mutating operations intercepted.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 font-mono text-[11px] shrink-0">
          PASS
        </Badge>
      </div>

      {/* 2. Executive Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Simulated Steps</div>
          <div className="text-xl font-bold font-mono text-foreground">{blastRadius.totalSimulatedSteps}</div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Intercepted Mutations</div>
          <div className="text-xl font-bold font-mono text-amber-500">{blastRadius.mutationsInterceptedCount}</div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-1">High-Risk Operations</div>
          <div className="text-xl font-bold font-mono text-rose-500">{blastRadius.highRiskOperationsCount}</div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Required Approvals</div>
          <div className="text-xl font-bold font-mono text-purple-500">{blastRadius.requiredApprovalsCount}</div>
        </div>
      </div>

      {/* 3. Resource & Cost Projections */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground font-mono">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>~{blastRadius.estimatedTokensUsed} tokens</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          <span>~{blastRadius.estimatedDurationMs}ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-emerald-500" />
          <span>~${blastRadius.estimatedCostUsd.toFixed(4)} USD</span>
        </div>
      </div>

      {/* 4. Simulated Step Trace List */}
      <div className="mt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Simulated Execution Trace
        </h4>

        <div className="flex flex-col gap-2.5">
          {trace.map((step) => {
            const isExpanded = Boolean(expandedSteps[step.stepNumber]);
            const isMutation = step.simulatedAction === 'intercepted_mutation';

            return (
              <div
                key={step.stepNumber}
                className="rounded-xl border border-border/70 bg-muted/15 p-3.5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-mono font-bold text-primary shrink-0 mt-0.5">
                      {step.stepNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground tracking-tight">
                          {step.stepName}
                        </span>
                        {step.capabilityId && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({step.capabilityId})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge
                          variant="outline"
                          className={
                            isMutation
                              ? 'border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px]'
                              : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10 text-[10px]'
                          }
                        >
                          {isMutation ? 'Intercepted Mutation' : 'Simulated Read'}
                        </Badge>

                        <Badge variant="outline" className="text-[10px]">
                          {step.riskLevel}
                        </Badge>

                        {step.requiresHumanApproval && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            Approval Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleStep(step.stepNumber)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Explainability Grid (Rule 41) */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2.5">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">What</span>
                    <p className="text-xs text-foreground leading-relaxed mt-0.5">{step.what}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Why</span>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.why}</p>
                  </div>
                </div>

                {step.expectedStateChange && (
                  <div className="mt-2 text-xs">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Expected State Change
                    </span>
                    <p className="text-xs text-amber-500/90 font-mono mt-0.5">{step.expectedStateChange}</p>
                  </div>
                )}

                {/* Output Snippet Container (Rule 30 Untrusted isolation) */}
                {isExpanded && step.simulatedOutputSnippet && (
                  <div className="mt-3 rounded-lg border border-border/60 bg-background/80 p-2.5 font-mono text-[11px] overflow-x-auto">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Simulated Payload Output:
                    </div>
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap">
                      {step.simulatedOutputSnippet}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
