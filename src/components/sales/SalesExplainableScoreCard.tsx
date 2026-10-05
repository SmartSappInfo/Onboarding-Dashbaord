'use client';

/**
 * @fileOverview Explainable Lead Score Card Component (Phase 10 Milestone 3 Task 3)
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Rule 41 Explainability Grid: Mandatory 3-part breakdown (WHAT, WHY, EXPECTED STATE CHANGE).
 * 2. Transparent Multi-Dimensional Drivers: 6 factor point contributions summing to overall score.
 * 3. Priority Tier Visuals: Bounded badges (critical, high, medium, cold).
 * 4. Strict Zero-any typing (Rule 4).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  Flame,
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { LeadScoreBreakdown } from '@/platform/agents/sales/context/lead-context-types';
import { cn } from '@/lib/utils';

export interface SalesExplainableScoreCardProps {
  breakdown: LeadScoreBreakdown;
  className?: string;
  onOpenModelConfig?: () => void;
}

export function SalesExplainableScoreCard({
  breakdown,
  className,
  onOpenModelConfig,
}: SalesExplainableScoreCardProps) {
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'critical':
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
            Critical Priority
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
            High Priority
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase tracking-wider">
            Qualified Lead
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            Cold Prospect
          </Badge>
        );
    }
  };

  const getExpectedStateChange = (tier: string, score: number) => {
    if (score >= 80 || tier === 'critical') {
      return 'Promote to autonomous SDR high-priority outbound queue with personalized WhatsApp angle.';
    }
    if (score >= 60 || tier === 'high') {
      return 'Queue for standard multi-touch email sequence and decision-maker enrichment.';
    }
    if (score >= 40 || tier === 'medium') {
      return 'Maintain in nurturing campaign; re-evaluate when subsequent buying signals appear.';
    }
    return 'Park in cold pool; trigger automated re-scoring in 60 days.';
  };

  const drivers = [
    { label: 'ICP Fit', points: breakdown.icpFitPoints, max: 30 },
    { label: 'Need Fit', points: breakdown.needPoints, max: 25 },
    { label: 'Intent Signals', points: breakdown.intentPoints, max: 20 },
    { label: 'Engagement', points: breakdown.engagementPoints, max: 15 },
    { label: 'Lookalike Fit', points: breakdown.similarityPoints, max: 10 },
  ];

  return (
    <div className={cn('p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-5', className)}>
      {/* Header Metric & Tier */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Explainable Score Breakdown
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Multi-dimensional deterministic intelligence calculation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getTierBadge(breakdown.priorityTier)}
          {onOpenModelConfig && (
            <button
              type="button"
              onClick={onOpenModelConfig}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Weights Model
            </button>
          )}
        </div>
      </div>

      {/* Main Score Hero */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Overall Priority Score
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {breakdown.overallScore}
            </span>
            <span className="text-xs text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>

        <div className="text-right space-y-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Conversion Affinity
          </span>
          <div className="text-xs font-semibold text-foreground flex items-center justify-end gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {breakdown.overallScore >= 75 ? 'Top 10% Affinity' : 'Standard Pipeline Fit'}
          </div>
        </div>
      </div>

      {/* Point Contributions Grid */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          Factor Point Contributions
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {drivers.map((d) => (
            <div key={d.label} className="p-2.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
              <div className="text-[10px] text-muted-foreground font-medium">{d.label}</div>
              <div className="text-xs font-bold text-foreground">
                +{d.points} <span className="text-[10px] text-muted-foreground font-normal">/ {d.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Positive & Negative Drivers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Positive Drivers */}
        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Top Positive Drivers</span>
          </div>
          <ul className="space-y-1 text-muted-foreground text-[11px]">
            {breakdown.topPositiveDrivers.map((driver, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-500 shrink-0">•</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Negative Risk Deductions */}
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Risk Deductions</span>
          </div>
          <ul className="space-y-1 text-muted-foreground text-[11px]">
            {breakdown.topNegativeDrivers.length > 0 ? (
              breakdown.topNegativeDrivers.map((driver, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-500 shrink-0">•</span>
                  <span>{driver}</span>
                </li>
              ))
            ) : (
              <li className="text-[11px] text-muted-foreground italic">No negative risk deductions flagged.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Rule 41 Explainability Grid: WHAT / WHY / EXPECTED STATE CHANGE */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-2.5 text-xs">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-primary" />
          <span>Rule 41 Operational Explainability</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">WHAT</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              ICP Score of <span className="font-semibold text-foreground">{breakdown.overallScore}/100</span> ({breakdown.priorityTier} tier) calculated from 5 deterministic vectors.
            </div>
          </div>

          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">WHY</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Driven by strong {breakdown.topPositiveDrivers[0] || 'ICP fit'} offset by {breakdown.topNegativeDrivers[0] || 'standard sector baseline'}.
            </div>
          </div>

          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">EXPECTED STATE CHANGE</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              {getExpectedStateChange(breakdown.priorityTier, breakdown.overallScore)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SalesExplainableScoreCard;
