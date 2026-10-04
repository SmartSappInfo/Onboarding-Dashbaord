'use client';

/**
 * @fileOverview Approval Metrics KPI Cards (Phase 3 Milestone 4 - Task 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Everyday English),
 * Rule 10 (Inline Architectural Documentation), and Rule 61 (Operator Console).
 */

import * as React from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export interface ApprovalMetrics {
  pendingCount: number;
  approved24hCount: number;
  rejectedCount: number;
  highBlastRadiusCount: number;
}

export interface ApprovalMetricsCardsProps {
  metrics: ApprovalMetrics;
}

export function ApprovalMetricsCards({ metrics }: ApprovalMetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
      {/* 1. Pending Approvals */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {(metrics?.pendingCount ?? 0).toLocaleString()}
          </span>
          {(metrics?.pendingCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Action Needed
            </span>
          )}
        </div>
      </div>

      {/* 2. Approved (24h) */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Approved (24h)</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {(metrics?.approved24hCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">Executed Cleanly</span>
        </div>
      </div>

      {/* 3. Rejected / Blocked */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {(metrics?.rejectedCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">Replanned</span>
        </div>
      </div>

      {/* 4. High Blast Radius */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">High Blast Radius</span>
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {(metrics?.highBlastRadiusCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">&gt; 100 entities</span>
        </div>
      </div>
    </div>
  );
}
