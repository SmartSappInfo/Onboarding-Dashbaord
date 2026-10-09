'use client';

/**
 * @fileOverview Delivery Performance & Channel Volume Analytics Chart.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Tabular nums across all counts, zero CLS.
 * - Rule 4: Strict typing, zero any.
 * - Rule 7: Everyday UI English, clean SVG progress ring.
 * - Rule 9: Lightweight rendering, zero heavy bundle overhead.
 */

import * as React from 'react';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PerformanceChartData, ChannelBreakdownItem } from '@/lib/types/messaging-dashboard';

export interface MessagingPerformanceChartsProps {
  performance?: PerformanceChartData;
  channelBreakdown?: ChannelBreakdownItem[];
  isLoading?: boolean;
  className?: string;
}

export function MessagingPerformanceCharts({
  performance,
  channelBreakdown = [],
  isLoading,
  className,
}: MessagingPerformanceChartsProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4', className)}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const rate = performance?.deliveryRatePercentage ?? 0;

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Delivery Performance</h3>
          <p className="text-xs text-muted-foreground">7-day outbound reliability and channel distribution</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted/30 text-muted-foreground">
          {performance?.timeRangeLabel ?? 'Last 7 days'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 items-center">
        {/* Delivery Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3 rounded-xl bg-muted/10 border border-border/60">
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="8" className="text-muted/30 fill-none" />
              <circle
                cx="48"
                cy="48"
                r="38"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - rate / 100)}
                className="text-emerald-500 fill-none transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">{rate}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Delivered</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> High Delivery SLA
          </div>
        </div>

        {/* Channel Distribution Bars */}
        <div className="md:col-span-7 space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Channel Volume Share
          </p>
          {channelBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No channel volume data for this period.</p>
          ) : (
            channelBreakdown.map((item) => (
              <div key={item.channel} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground tabular-nums">{item.percentage}% ({item.count.toLocaleString()})</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
