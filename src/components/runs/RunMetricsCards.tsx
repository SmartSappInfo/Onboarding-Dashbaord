'use client';

/**
 * @fileOverview Executive KPI Cards for Agent Runs Mission Control (Phase 8 Milestone 2)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first responsive grid and >= 44px touch targets.
 * - Rule 21: Awaiting approval badge linking to human-in-the-loop triage.
 * - Rule 25: Failed / DLQ highlight.
 */

import React from 'react';
import { Bot, Sparkles, AlertTriangle, AlertCircle } from 'lucide-react';

export interface RunMetricsCardsProps {
  totalRuns: number;
  activeRuns: number;
  waitingApprovalRuns: number;
  failedRuns: number;
  isLoading?: boolean;
}

export function RunMetricsCards({
  totalRuns,
  activeRuns,
  waitingApprovalRuns,
  failedRuns,
  isLoading = false,
}: RunMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Runs */}
      <div className="p-4 rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Runs
          </p>
          <p className="text-2xl font-bold font-mono text-foreground">
            {isLoading ? '...' : (totalRuns ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">All personas across workspace</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
          <Bot className="h-5 w-5" />
        </div>
      </div>

      {/* 2. Active / Running */}
      <div className="p-4 rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Executions
            </p>
            {activeRuns > 0 && (
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            )}
          </div>
          <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {isLoading ? '...' : (activeRuns ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">In-flight DAG & Swarm plans</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      {/* 3. Awaiting Approval (Rule 21) */}
      <div className="p-4 rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Awaiting Approval
            </p>
            {waitingApprovalRuns > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {isLoading ? '...' : (waitingApprovalRuns ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">Two-phase human gate (Rule 21)</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>

      {/* 4. Failed / DLQ (Rule 25) */}
      <div className="p-4 rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Failed / DLQ
          </p>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {isLoading ? '...' : (failedRuns ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">Triaged or compensation triggered</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
          <AlertCircle className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
