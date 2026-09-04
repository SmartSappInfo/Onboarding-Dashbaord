'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Executive Intelligence Ribbon
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Emil Kowalski Micro-Interactions (Rule 1):
 *    - Uses `active:scale-[0.97]` and smooth `duration-200` transitions for interactive cards.
 * 2. Mobile Touch Targets (Rule 7):
 *    - All interactive surfaces maintain `min-h-[44px]` touch targets.
 * 3. Strict Zero-`any` Standard (Rule 4):
 *    - Strongly typed with `ExecutiveIntelligenceSummary`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import type { ExecutiveIntelligenceSummary } from '@/lib/intelligence/types';
import { Button } from '@/components/ui/button';

interface ExecutiveIntelligenceRibbonProps {
  summary: ExecutiveIntelligenceSummary;
  onRefreshScan?: () => void;
  isScanning?: boolean;
}

export function ExecutiveIntelligenceRibbon({
  summary,
  onRefreshScan,
  isScanning,
}: ExecutiveIntelligenceRibbonProps) {
  // Compute color tier for health score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 via-card/70 to-card/50 p-4 sm:p-6 backdrop-blur-xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-primary/10 text-primary">
              <Cpu className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Continuous Organizational Intelligence
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
              Autonomous
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Real-time pattern detection across deals, meetings, atomic memories, and agent workflows.
          </p>
        </div>

        {onRefreshScan && (
          <Button
            onClick={onRefreshScan}
            disabled={isScanning}
            variant="outline"
            className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-2 active:scale-[0.97] transition-all self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Analyzing Patterns...' : 'Run Intelligence Sweep'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 pt-4">
        {/* Metric 1: Health Index */}
        <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Health Index</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {summary.overallHealthScore}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">/ 100</span>
          </div>
          <div className="mt-1">
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getScoreColor(
                summary.overallHealthScore
              )}`}
            >
              {summary.overallHealthScore >= 80 ? 'Optimal' : summary.overallHealthScore >= 60 ? 'Moderate' : 'Needs Attention'}
            </span>
          </div>
        </div>

        {/* Metric 2: Active Risks */}
        <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Emerging Risks</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-500">
              {summary.activeRiskCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {summary.activeRiskCount === 0 ? 'Zero active blockers' : 'Requires review'}
          </p>
        </div>

        {/* Metric 3: Opportunities */}
        <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Opportunities</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
              {summary.activeOpportunityCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            High-conviction expansion
          </p>
        </div>

        {/* Metric 4: Knowledge Freshness */}
        <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Memory Freshness</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {summary.knowledgeFreshnessRating}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {summary.staleMemoriesCount} stale candidates
          </p>
        </div>

        {/* Metric 5: Agent Efficiency */}
        <div className="col-span-2 sm:col-span-1 flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Agent Efficiency</span>
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {summary.agentEfficiencyIndex}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {summary.pipelineVelocityTrend === 'accelerating' ? 'Velocity accelerating' : 'Stable execution'}
          </p>
        </div>
      </div>
    </div>
  );
}
