'use client';

/**
 * @fileOverview AnalyticsExecutionTab component (Phase 4C).
 *
 * Implements:
 * - Velocity & Execution metrics:
 *   - Average Lead Time (Created to Done)
 *   - Average Cycle Time (In Progress to Done)
 *   - On-Time Delivery Rate (%)
 *   - Throughput (tasks delivered)
 * - Category delivery distribution
 * - Clickable drill-down navigation to /admin/tasks.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Clock,
  Timer,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import type { TaskAnalyticsExtended } from '@/lib/analytics/task-analytics-service';

export interface AnalyticsExecutionTabProps {
  analytics: TaskAnalyticsExtended;
}

export function AnalyticsExecutionTab({ analytics }: AnalyticsExecutionTabProps) {
  return (
    <div className="space-y-6 font-figtree">
      {/* Velocity Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Lead Time */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Average Lead Time</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {analytics.avgLeadTimeDays}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            From creation to final completion
          </p>
        </div>

        {/* Cycle Time */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Average Cycle Time</span>
            <Timer className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {analytics.avgCycleTimeDays}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Active execution duration
          </p>
        </div>

        {/* Throughput */}
        <Link
          href="/admin/tasks?status=done"
          className="group block p-5 rounded-2xl border border-border/80 bg-card hover:border-border transition-all active:scale-[0.97] shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Throughput Delivered</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary">
              {analytics.throughputPerWeek}
            </span>
            <span className="text-xs text-muted-foreground">completed tasks</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click to view delivered work items
          </p>
        </Link>
      </div>

      {/* Category Performance Breakdown */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Functional Category Distribution
            </h3>
            <p className="text-xs text-muted-foreground">
              Volume allocation across operational categories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(analytics.tasksByCategory)
            .filter(([_, count]) => count > 0)
            .map(([cat, count]) => {
              const pct =
                analytics.totalTasks > 0
                  ? Math.round((count / analytics.totalTasks) * 100)
                  : 0;
              return (
                <Link
                  key={cat}
                  href={`/admin/tasks?category=${cat}`}
                  className="p-3.5 rounded-xl border border-border/70 hover:border-border bg-card/60 hover:bg-muted/30 transition-all active:scale-[0.97] flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold capitalize text-foreground">{cat}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {count} tasks ({pct}%)
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/60" />
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
