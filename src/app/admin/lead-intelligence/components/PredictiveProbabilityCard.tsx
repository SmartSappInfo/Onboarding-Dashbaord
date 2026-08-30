'use client';

/**
 * Predictive Conversion Probability Card (Lead Intelligence 2.0 - Phase 13)
 * UI Spec Section 52: "Phase 13 UX — Predictive Intelligence"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Strictly distinguishes Predictive Probability (0-100% conversion forecast) from Deterministic Rubric Scores.
 * 2. 3-Stage forward progression: Meeting -> Opportunity -> Close.
 * 3. Dynamic Expected ACV badge sizing.
 * 4. Mobile-responsive with touch targets >= 44px.
 * 5. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Calendar, 
  Briefcase, 
  CheckCircle2, 
  DollarSign, 
  Sparkles, 
  Info,
  ShieldCheck
} from 'lucide-react';
import type { PredictiveConversionLikelihood } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface PredictiveProbabilityCardProps {
  likelihood: PredictiveConversionLikelihood;
  className?: string;
}

export const PredictiveProbabilityCard: React.FC<PredictiveProbabilityCardProps> = ({
  likelihood,
  className
}) => {
  return (
    <Card className={cn("bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4", className)}>
      {/* Header with Title & ACV Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Predictive Conversion Forecast
            </span>
          </div>
          <h4 className="text-sm font-black text-foreground">
            Forward-Looking Conversion Likelihood
          </h4>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold px-2.5 py-1">
            Est. ACV: {likelihood.currency} {likelihood.expectedACV.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
            {likelihood.confidenceLevel} Confidence
          </Badge>
        </div>
      </div>

      {/* 3-Stage Progress Gauges (UI Spec Section 52) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Stage 1: Meeting */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />
              <span>Meeting</span>
            </span>
            <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
              {likelihood.meetingProbability}%
            </span>
          </div>
          <Progress value={likelihood.meetingProbability} className="h-2 bg-muted [&>div]:bg-sky-500" />
          <span className="text-[10px] text-muted-foreground block">First call / demo booked</span>
        </div>

        {/* Stage 2: Opportunity */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-purple-500" />
              <span>Opportunity</span>
            </span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
              {likelihood.opportunityProbability}%
            </span>
          </div>
          <Progress value={likelihood.opportunityProbability} className="h-2 bg-muted [&>div]:bg-purple-500" />
          <span className="text-[10px] text-muted-foreground block">Formal proposal in review</span>
        </div>

        {/* Stage 3: Close */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Contract Close</span>
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {likelihood.closeProbability}%
            </span>
          </div>
          <Progress value={likelihood.closeProbability} className="h-2 bg-muted [&>div]:bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground block">Closed-Won contract signing</span>
        </div>
      </div>

      {/* Top Predictive Drivers */}
      {likelihood.topDrivers && likelihood.topDrivers.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" /> Key Predictive Drivers
          </span>
          <div className="space-y-1">
            {likelihood.topDrivers.map((driver, i) => (
              <div key={i} className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>{driver}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informative Rubric Distinction Footnote */}
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 italic pt-1">
        <Info className="w-3 h-3 text-muted-foreground shrink-0" />
        <span>Statistical conversion forecast calculated from tech maturity and historic win patterns. Kept distinct from 0-100 rubric scores.</span>
      </p>
    </Card>
  );
};
