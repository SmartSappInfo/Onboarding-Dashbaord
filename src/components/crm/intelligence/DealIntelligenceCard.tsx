'use client';

/**
 * @fileOverview Deal Intelligence Card Component (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 41 (Explainability Grid), and `theme.md` §8.
 *
 * Displays:
 * - Deal Stage Velocity meter (days in stage vs baseline threshold)
 * - Win Probability Forecast gauge & Deal Health Category
 * - Competitor Objections & Tactical Counter-Strategies
 * - Recommended Playbook Steps
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  TrendingUp,
  Clock,
  ShieldAlert,
  Zap,
  Swords,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';
import type { DealIntelligence } from '@/platform/agents/crm/intelligence/crm-intelligence-types';

export interface DealIntelligenceCardProps {
  dealIntelligence: DealIntelligence;
  className?: string;
}

export function DealIntelligenceCard({
  dealIntelligence,
  className,
}: DealIntelligenceCardProps) {
  const {
    dealTitle,
    dealValue,
    currency,
    stageVelocity,
    winProbability,
    healthScore,
    healthCategory,
    stallRisk,
    buyingSignals,
    riskFactors,
    competitorAnalysis,
    recommendedPlaybook,
  } = dealIntelligence;

  const getHealthBadge = (category: DealIntelligence['healthCategory']) => {
    switch (category) {
      case 'STRONG':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'STABLE':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'AT_RISK':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'CRITICAL':
      default:
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    }
  };

  const getVelocityBadge = (status: DealIntelligence['stageVelocity']['velocityStatus']) => {
    switch (status) {
      case 'FAST':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'NORMAL':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'SLOW':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'STALLED':
      default:
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold';
    }
  };

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(dealValue);

  return (
    <Card className={cn('rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm', className)}>
      <CardHeader className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold tracking-tight">Deal Intelligence</CardTitle>
            <CardInfoTooltip text="Algorithmic pipeline velocity, win forecast, and competitor battlecard intelligence." />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5 rounded-full font-semibold', getHealthBadge(healthCategory))}>
            {healthCategory}
          </Badge>
          <span className="text-sm font-bold text-foreground">{formattedValue}</span>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Deal Header Overview Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/70">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{dealTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pipeline Stage Health Score: <span className="font-bold text-foreground">{healthScore}/100</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Win Probability</span>
              <span className="text-xl font-extrabold text-primary">{winProbability}%</span>
            </div>
            <div className="h-8 w-px bg-border/80 hidden sm:block" />
            <div className="text-center sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Velocity</span>
              <Badge variant="outline" className={cn('text-xs px-2 py-0.5 rounded-md font-semibold mt-0.5', getVelocityBadge(stageVelocity.velocityStatus))}>
                {stageVelocity.velocityStatus}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stage Velocity Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Stage Velocity Duration
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{stageVelocity.daysInStage} days</span> in stage (benchmark: {stageVelocity.averageDaysInStage}d)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                stageVelocity.daysInStage > stageVelocity.averageDaysInStage ? 'bg-amber-500' : 'bg-primary'
              )}
              style={{
                width: `${Math.min(100, Math.round((stageVelocity.daysInStage / (stageVelocity.averageDaysInStage * 1.5)) * 100))}%`,
              }}
            />
          </div>
          {stallRisk.isStalled && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium pt-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Deal stalled: {stallRisk.daysSinceActivity} days since last logged communication</span>
            </div>
          )}
        </div>

        {/* 2-Column: Buying Signals & Risk Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Buying Signals */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              Buying Signals ({buyingSignals.length})
            </div>
            {buyingSignals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No buying signals detected yet.</p>
            ) : (
              <ul className="space-y-2">
                {buyingSignals.map((sig, idx) => (
                  <li key={idx} className="text-xs text-foreground/90 flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{sig.signal}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Risk Factors */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              Risk Factors ({riskFactors.length})
            </div>
            {riskFactors.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Zero high-severity deal risks identified.</p>
            ) : (
              <ul className="space-y-2">
                {riskFactors.map((rf, idx) => (
                  <li key={idx} className="text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{rf.risk}</span>
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/20">
                        {rf.severity}
                      </Badge>
                    </div>
                    {rf.mitigationPrompt && (
                      <p className="text-[11px] text-muted-foreground">Mitigation: {rf.mitigationPrompt}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Competitor Objections Breakdown */}
        {competitorAnalysis.length > 0 && (
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Swords className="h-3.5 w-3.5 text-primary" />
              Competitor Objections & Battlecard Strategies
            </div>
            <div className="space-y-2">
              {competitorAnalysis.map((comp, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/15 border border-border/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{comp.competitorName}</span>
                    <Badge variant="outline" className="text-[10px]">Competitor Angle</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Objection:</span> {comp.objection}
                  </p>
                  <p className="text-xs text-foreground/90 font-medium">
                    <span className="text-primary font-semibold">Counter-Strategy:</span> {comp.counterStrategy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Playbook */}
        {recommendedPlaybook && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Recommended Playbook:</span>
              <span>{recommendedPlaybook.strategyName}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Expected Outcome: {recommendedPlaybook.expectedOutcome}
            </p>
            <div className="space-y-1.5 pt-1">
              {recommendedPlaybook.tacticalSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                  <span className="h-4 w-4 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
