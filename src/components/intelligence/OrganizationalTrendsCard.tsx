'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Organizational Trends & Analytics Card
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Trend Synthesis:
 *    - Renders macro organizational velocity trends, sentiment momentum, and communication cadence.
 * 2. Mobile Accessibility (Rule 7):
 *    - Responsive cards and touch-friendly controls.
 * 3. Strict Zero-`any` Compliance (Rule 4):
 *    - Strongly typed with `ObservationTrend`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import type { ObservationTrend } from '@/lib/intelligence/types';

interface OrganizationalTrendsCardProps {
  trends: ObservationTrend[];
}

export function OrganizationalTrendsCard({ trends }: OrganizationalTrendsCardProps) {
  const getDirectionIcon = (direction: ObservationTrend['direction']) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-rose-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getDirectionBadge = (direction: ObservationTrend['direction']) => {
    switch (direction) {
      case 'increasing':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'decreasing':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Macro Organizational Trends
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rolling momentum signals across deal velocity, sentiment, and knowledge capture.
          </p>
        </div>
      </div>

      {trends.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-muted/10 border border-dashed border-border/60 text-xs text-muted-foreground">
          Trend models require at least 7 days of continuous organizational activity to synthesize curves.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{trend.topic}</h4>
                  <span className="text-[11px] text-muted-foreground">
                    {trend.timeHorizonDays}-day observation horizon
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${getDirectionBadge(
                    trend.direction
                  )}`}
                >
                  {getDirectionIcon(trend.direction)}
                  <span className="capitalize">{trend.direction}</span>
                </div>
              </div>

              {/* Insights bullet list */}
              <div className="space-y-1.5 pt-1">
                {trend.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>

              {/* Velocity Score Bar */}
              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Velocity Shift</span>
                  <span className="font-bold text-foreground">
                    {trend.velocityScore > 0 ? `+${Math.round(trend.velocityScore * 100)}%` : `${Math.round(trend.velocityScore * 100)}%`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${trend.velocityScore >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{
                      width: `${Math.min(100, Math.max(10, Math.abs(trend.velocityScore) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
