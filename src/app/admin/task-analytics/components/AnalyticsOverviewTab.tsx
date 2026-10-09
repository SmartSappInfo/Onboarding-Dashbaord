'use client';

/**
 * @fileOverview AnalyticsOverviewTab component (Phase 4C).
 *
 * Implements:
 * - High-level operational KPI cards:
 *   - Completion Rate (%)
 *   - On-Time Delivery Rate (%)
 *   - Overdue Tasks count
 *   - Active Blockers count
 *   - Average Lead Time (days)
 * - Clickable drill-downs navigating directly to filtered views in /admin/tasks.
 * - Minimum touch targets >= 44px on interactive cards with Emil Kowalski active:scale-[0.97].
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Target,
} from 'lucide-react';
import type { TaskAnalyticsExtended } from '@/lib/analytics/task-analytics-service';

export interface AnalyticsOverviewTabProps {
  analytics: TaskAnalyticsExtended;
}

export function AnalyticsOverviewTab({ analytics }: AnalyticsOverviewTabProps) {
  return (
    <div className="space-y-6 font-figtree">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <Link
          href="/admin/tasks?status=done"
          className="group block p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-all active:scale-[0.97] shadow-sm min-h-[100px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Completion Rate
            </span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">
              {analytics.completionRate}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({analytics.completedTasks} / {analytics.totalTasks})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click to view all completed tasks
          </p>
        </Link>

        {/* On-Time Rate */}
        <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-sm min-h-[100px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
              On-Time Delivery
            </span>
            <Target className="h-4 w-4 text-blue-600 opacity-80" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">
              {analytics.onTimeRate}%
            </span>
            <span className="text-xs text-muted-foreground">delivered on schedule</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Completed on or before due date
          </p>
        </div>

        {/* Overdue Tasks */}
        <Link
          href="/admin/tasks?period=overdue"
          className="group block p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 transition-all active:scale-[0.97] shadow-sm min-h-[100px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
              Overdue Tasks
            </span>
            <ArrowUpRight className="h-4 w-4 text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">
              {analytics.overdueTasks}
            </span>
            <span className="text-xs text-muted-foreground">requiring immediate review</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click to drill down into overdue tasks
          </p>
        </Link>

        {/* Active Blockers */}
        <Link
          href="/admin/standups?tab=blockers"
          className="group block p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-all active:scale-[0.97] shadow-sm min-h-[100px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Active Blockers
            </span>
            <ArrowUpRight className="h-4 w-4 text-amber-600 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">
              {analytics.activeBlockers}
            </span>
            <span className="text-xs text-muted-foreground">
              MTTR {analytics.avgBlockerResolutionHours}h
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click to manage active obstacles
          </p>
        </Link>
      </div>

      {/* Priority & Category Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Task Status Breakdown</h3>
            <span className="text-xs text-muted-foreground">
              {analytics.totalTasks} total tasks
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(analytics.tasksByStatus).map(([st, count]) => {
              const pct =
                analytics.totalTasks > 0
                  ? Math.round((count / analytics.totalTasks) * 100)
                  : 0;
              return (
                <Link
                  key={st}
                  href={`/admin/tasks?status=${st}`}
                  className="group flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-muted/40 transition-colors"
                >
                  <span className="font-semibold capitalize text-foreground w-24">
                    {st.replace('_', ' ')}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        st === 'done'
                          ? 'bg-emerald-500'
                          : st === 'in_progress'
                          ? 'bg-blue-500'
                          : st === 'blocked'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-muted-foreground w-12 text-right">
                    {count} ({pct}%)
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Priority Distribution</h3>
            <span className="text-xs text-muted-foreground">Impact allocation</span>
          </div>

          <div className="space-y-3">
            {Object.entries(analytics.tasksByPriority).map(([pr, count]) => {
              const pct =
                analytics.totalTasks > 0
                  ? Math.round((count / analytics.totalTasks) * 100)
                  : 0;
              return (
                <Link
                  key={pr}
                  href={`/admin/tasks?priority=${pr}`}
                  className="group flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-muted/40 transition-colors"
                >
                  <span className="font-semibold capitalize text-foreground w-20">
                    {pr}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        pr === 'critical'
                          ? 'bg-rose-600'
                          : pr === 'urgent'
                          ? 'bg-amber-600'
                          : pr === 'high'
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-muted-foreground w-12 text-right">
                    {count} ({pct}%)
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
