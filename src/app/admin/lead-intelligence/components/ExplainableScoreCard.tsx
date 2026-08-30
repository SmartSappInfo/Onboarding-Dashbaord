'use client';

/**
 * Explainable Score Breakdown Card (Lead Intelligence 2.0 - Phase 8)
 * UI Spec Section 34: "Advanced Scoring — The score must never be a black box"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 6 Transparent point contributions summing to overall score.
 * 2. Visual harmonic multiplier rating.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  Target, 
  Zap, 
  Clock 
} from 'lucide-react';
import type { Prospect, LeadSignal, ExplainableScoreBreakdown } from '@/lib/lead-intelligence/types';
import { ExplainableScoringEngine } from '@/lib/lead-intelligence/scoring';
import { cn } from '@/lib/utils';

interface ExplainableScoreCardProps {
  prospect: Prospect;
  signals?: LeadSignal[];
  className?: string;
  onOpenModelConfig?: () => void;
}

export const ExplainableScoreCard: React.FC<ExplainableScoreCardProps> = ({
  prospect,
  signals = [],
  className,
  onOpenModelConfig
}) => {
  const breakdown: ExplainableScoreBreakdown = React.useMemo(() => {
    return (
      prospect.scoring?.explainableBreakdown ||
      ExplainableScoringEngine.calculateExplainableScore(prospect, signals)
    );
  }, [prospect, signals]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'critical':
        return <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/40 text-[10px] font-bold uppercase tracking-wider">Critical Priority</Badge>;
      case 'high':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-sky-500/20 text-sky-600 border-sky-500/40 text-[10px] font-bold uppercase tracking-wider">Qualified Lead</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Cold Prospect</Badge>;
    }
  };

  return (
    <div className={cn("p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4", className)}>
      {/* Header Metric & Tier */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Explainable Score Breakdown
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground pt-0.5">
            Multi-dimensional deterministic intelligence calculation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getTierBadge(breakdown.priorityTier)}
          {onOpenModelConfig && (
            <button
              onClick={onOpenModelConfig}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Weights Model
            </button>
          )}
        </div>
      </div>

      {/* Main Score Hero Card */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/60">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Overall Priority Score</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {breakdown.overallScore}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">/ 100</span>
          </div>
        </div>

        <div className="text-right space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Harmonic Multiplier</span>
          <div className="flex items-center justify-end gap-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{breakdown.harmonicPriority}% Fit-Velocity</span>
          </div>
        </div>
      </div>

      {/* 6 Transparent Point Contribution Dimensions (UI Spec Section 34) */}
      <div className="space-y-2.5">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
          Dimension Point Attribution
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Dimension 1: ICP Fit */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-sky-500" /> ICP Fit
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                +{breakdown.icpFitPoints}
              </span>
            </div>
            <Progress value={(breakdown.icpFitPoints / 30) * 100} className="h-1 bg-muted" />
          </div>

          {/* Dimension 2: Need Score */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-amber-500" /> Need Gaps
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                +{breakdown.needPoints}
              </span>
            </div>
            <Progress value={(breakdown.needPoints / 20) * 100} className="h-1 bg-muted" />
          </div>

          {/* Dimension 3: Intent Signals */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <Flame className="h-3 w-3 text-rose-500" /> Intent Signals
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                +{breakdown.intentPoints}
              </span>
            </div>
            <Progress value={(breakdown.intentPoints / 25) * 100} className="h-1 bg-muted" />
          </div>

          {/* Dimension 4: Engagement */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <Users className="h-3 w-3 text-emerald-500" /> Contacts
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                +{breakdown.engagementPoints}
              </span>
            </div>
            <Progress value={(breakdown.engagementPoints / 15) * 100} className="h-1 bg-muted" />
          </div>

          {/* Dimension 5: Similarity */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-purple-500" /> Similarity
              </span>
              <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                +{breakdown.similarityPoints}
              </span>
            </div>
            <Progress value={(breakdown.similarityPoints / 10) * 100} className="h-1 bg-muted" />
          </div>

          {/* Dimension 6: Recency Bonus */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground/90 flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" /> Recency
              </span>
              <span className="font-bold text-primary font-mono">
                +{breakdown.recencyPoints}
              </span>
            </div>
            <Progress value={(breakdown.recencyPoints / 6) * 100} className="h-1 bg-muted" />
          </div>
        </div>
      </div>

      {/* Top Positive & Negative Drivers */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
          Key Positive & Negative Score Drivers
        </span>

        <div className="space-y-1.5">
          {breakdown.topPositiveDrivers.map((driver, idx) => (
            <div key={`pos-${idx}`} className="flex items-start gap-2 text-xs text-foreground/90">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{driver}</span>
            </div>
          ))}

          {breakdown.topNegativeDrivers.map((driver, idx) => (
            <div key={`neg-${idx}`} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{driver}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
