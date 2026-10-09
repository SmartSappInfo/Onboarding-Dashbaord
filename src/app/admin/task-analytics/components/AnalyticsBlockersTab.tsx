'use client';

/**
 * @fileOverview AnalyticsBlockersTab component (Phase 4C).
 *
 * Implements:
 * - Obstacle analytics and resolution velocity (MTTR in hours).
 * - Blocker severity and category breakdown.
 * - Drill-down CTA link directly to /admin/standups?tab=blockers.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TaskAnalyticsExtended } from '@/lib/analytics/task-analytics-service';
import type { BlockerRecord } from '@/lib/types';

export interface AnalyticsBlockersTabProps {
  analytics: TaskAnalyticsExtended;
  blockers?: BlockerRecord[];
}

export function AnalyticsBlockersTab({
  analytics,
  blockers = [],
}: AnalyticsBlockersTabProps) {
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    blockers.forEach((b) => {
      counts[b.category] = (counts[b.category] || 0) + 1;
    });
    return counts;
  }, [blockers]);

  const severityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    blockers.forEach((b) => {
      counts[b.severity] = (counts[b.severity] || 0) + 1;
    });
    return counts;
  }, [blockers]);

  return (
    <div className="space-y-6 font-figtree">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-2">
          <p className="text-xs font-bold text-muted-foreground">Total Blockers</p>
          <p className="text-3xl font-black text-foreground">{analytics.totalBlockers}</p>
          <p className="text-[11px] text-muted-foreground">All logged obstacles</p>
        </div>

        <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-sm space-y-2">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
            Active Blockers
          </p>
          <p className="text-3xl font-black text-amber-600">{analytics.activeBlockers}</p>
          <p className="text-[11px] text-muted-foreground">Unresolved dependencies</p>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm space-y-2">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            Resolved Blockers
          </p>
          <p className="text-3xl font-black text-emerald-600">
            {analytics.resolvedBlockers}
          </p>
          <p className="text-[11px] text-muted-foreground">Successfully unblocked</p>
        </div>

        <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-sm space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
            Resolution MTTR
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-blue-600">
              {analytics.avgBlockerResolutionHours}
            </span>
            <span className="text-xs text-muted-foreground">hours avg</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Mean time to resolution</p>
        </div>
      </div>

      {/* Severity & Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Severity Breakdown */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-foreground">Blocker Severity Breakdown</h3>
          <div className="space-y-2.5">
            {['critical', 'high', 'medium', 'low'].map((sev) => {
              const count = severityCounts[sev] || 0;
              const pct =
                analytics.totalBlockers > 0
                  ? Math.round((count / analytics.totalBlockers) * 100)
                  : 0;
              return (
                <div key={sev} className="flex items-center justify-between text-xs">
                  <span className="font-semibold capitalize text-foreground w-20">
                    {sev}
                  </span>
                  <div className="flex-1 mx-3 h-2.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sev === 'critical'
                          ? 'bg-rose-600'
                          : sev === 'high'
                          ? 'bg-amber-600'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-foreground">Blocker Root Cause Categories</h3>
          <div className="space-y-2.5">
            {['technical', 'external', 'access', 'review', 'other'].map((cat) => {
              const count = categoryCounts[cat] || 0;
              const pct =
                analytics.totalBlockers > 0
                  ? Math.round((count / analytics.totalBlockers) * 100)
                  : 0;
              return (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="font-semibold capitalize text-foreground w-24">
                    {cat}
                  </span>
                  <div className="flex-1 mx-3 h-2.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drill-down CTA */}
      <div className="p-5 rounded-2xl border border-border/80 bg-muted/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-foreground">
            Manage Active Team Blockers
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acknowledge, assign owners, escalate, and resolve active blockers in real time.
          </p>
        </div>
        <Button
          asChild
          className="rounded-xl h-11 min-h-[44px] px-5 text-xs font-bold active:scale-[0.97]"
        >
          <Link href="/admin/standups?tab=blockers">
            Open Blockers Manager
            <ArrowUpRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
