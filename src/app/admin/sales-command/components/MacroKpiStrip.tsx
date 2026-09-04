'use client';

/**
 * @fileoverview Macro KPI Metric Strip for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 38 & UI Section 39:
 * - 6-metric executive revenue and pipeline cockpit:
 *   1. Closed Revenue (Won deals)
 *   2. Active Pipeline Value
 *   3. Weighted Forecast
 *   4. Team Quota Attainment %
 *   5. Win Rate %
 *   6. Average Sales Velocity (days)
 * - High-contrast glassmorphic bento cards with responsive progressive disclosure.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on mobile interactions.
 * - Strict typing with zero 'any'.
 * - Micro-interactions use active:scale-[0.97] and sub-200ms transitions.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  DollarSign,
  TrendingUp,
  Target,
  Clock,
  Award,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import type { TeamMacroKPIs } from '@/lib/manager-command/types';

interface MacroKpiStripProps {
  kpis: TeamMacroKPIs;
  className?: string;
}

export function MacroKpiStrip({ kpis, className = '' }: MacroKpiStripProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 ${className}`}>
      {/* 1. Closed Revenue Won */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Revenue Won</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono truncate">
              {kpis.closedRevenueWon.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold">GHS</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
            Closed in current cycle
          </p>
        </CardContent>
      </Card>

      {/* 2. Active Pipeline */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Open Pipeline</span>
            <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono truncate">
              {kpis.activePipelineValue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold">GHS</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            {kpis.dealsAtRiskCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold inline-flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" /> {kpis.dealsAtRiskCount} at risk
              </span>
            ) : (
              'Healthy pipeline'
            )}
          </p>
        </CardContent>
      </Card>

      {/* 3. Weighted Forecast */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Forecast</span>
            <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono truncate">
              {kpis.weightedForecastValue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold">GHS</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            Probability-weighted
          </p>
        </CardContent>
      </Card>

      {/* 4. Quota Attainment */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Team Quota</span>
            <Target className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
              {kpis.quotaAttainmentPercent}%
            </span>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                kpis.quotaAttainmentPercent >= 85 ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(kpis.quotaAttainmentPercent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. Win Rate */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Win Rate</span>
            <Award className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
              {kpis.winRatePercent}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            Closed opportunities
          </p>
        </CardContent>
      </Card>

      {/* 6. Average Velocity */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase text-[10px] tracking-wider">Sales Velocity</span>
            <Clock className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
              {kpis.averageVelocityDays}
            </span>
            <span className="text-xs text-muted-foreground font-bold">days</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            Creation to closed won
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
