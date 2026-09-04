'use client';

/**
 * @fileoverview Organizational Behavioral Archetypes & AI Strategic Recommendations Tab (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10:
 * - Team execution archetyping: Strategic Closer, Transactional Hunter, Maverick Solo Closer.
 * - Revenue correlation scoring (-1.0 to +1.0) based on win rate, cycle speed, and multi-threading.
 * - AI Executive Strategic Recommendations with projected revenue yield.
 * - 1-Click "Enact Strategy" Server Action execution awarding +25 effort points.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile ergonomics: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 * - Division-by-zero protected by safe fallback values.
 *
 * @testability Pure presentation component with deterministic callback bindings.
 */

import * as React from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import type {
  OrganizationalBehaviorArchetype,
  AiStrategicRecommendation,
} from '@/lib/revenue-os/types';

interface OrganizationalStrategyTabProps {
  archetypes: OrganizationalBehaviorArchetype[];
  strategicRecommendations: AiStrategicRecommendation[];
  onApplyRecommendation: (recId: string) => Promise<void>;
  isApplying: boolean;
}

export function OrganizationalStrategyTab({
  archetypes,
  strategicRecommendations,
  onApplyRecommendation,
  isApplying,
}: OrganizationalStrategyTabProps) {
  const [applyingId, setApplyingId] = React.useState<string | null>(null);

  const handleApply = async (recId: string) => {
    try {
      setApplyingId(recId);
      await onApplyRecommendation(recId);
    } finally {
      setApplyingId(null);
    }
  };

  const activeRecommendations = strategicRecommendations.filter((r) => r.status === 'active');
  const appliedRecommendations = strategicRecommendations.filter((r) => r.status === 'applied');

  return (
    <div className="space-y-8">
      {/* Strategic AI Recommendations Section */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground">
                AI Strategic Executive Recommendations
              </CardTitle>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-2xs font-bold">
                Boardroom Levers
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-leverage interventions generated from pipeline analysis, ramp bottlenecks, and behavioral patterns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-2xs font-semibold">
              {activeRecommendations.length} Pending Execution
            </Badge>
            {appliedRecommendations.length > 0 && (
              <Badge variant="outline" className="text-2xs font-semibold text-emerald-600 border-emerald-500/30">
                {appliedRecommendations.length} Enacted
              </Badge>
            )}
          </div>
        </div>

        {/* Recommendations List */}
        <div className="divide-y divide-border/40 pt-2 space-y-4">
          {strategicRecommendations.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No strategic recommendations currently available. System is operating at peak efficiency.
            </div>
          ) : (
            strategicRecommendations.map((rec) => {
              const isApplied = rec.status === 'applied';
              const isPendingThis = applyingId === rec.id;

              return (
                <div
                  key={rec.id}
                  className="pt-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rec.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-3xs font-semibold uppercase tracking-wider px-1.5 py-0 ${
                          rec.priority === 'critical'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            : rec.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                        }`}
                      >
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline" className="text-3xs font-semibold uppercase capitalize px-1.5 py-0">
                        {rec.category}
                      </Badge>
                      <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                        +${(rec.projectedRevenueImpactDollars / 1000).toLocaleString()}k Projected Yield
                      </span>
                    </div>

                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {rec.description}
                    </p>

                    <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-2xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Executive Rationale
                      </div>
                      <p>{rec.rationale}</p>
                    </div>

                    {isApplied && (
                      <div className="flex items-center gap-1.5 text-2xs text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Enacted by {rec.appliedBy || 'Executive Leadership'} on {rec.appliedAt ? new Date(rec.appliedAt).toLocaleDateString() : 'Active Quarter'}</span>
                      </div>
                    )}
                  </div>

                  {/* 1-Click Execution Action */}
                  <div className="flex lg:flex-col items-end justify-between lg:justify-start gap-3 flex-shrink-0 pt-1">
                    <div className="text-right">
                      <span className="text-2xs text-muted-foreground block">AI Confidence</span>
                      <span className="text-xs font-bold text-foreground font-mono">
                        {rec.confidenceScore}%
                      </span>
                    </div>

                    {!isApplied ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApply(rec.id)}
                        disabled={isApplying || isPendingThis}
                        className="h-10 px-4 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform shadow-sm gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>{isPendingThis ? 'Enacting...' : 'Enact Strategy (+25 pts)'}</span>
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-semibold py-1 px-2.5">
                        Active Strategy
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Team Behavioral Archetypes Section */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="pb-5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-foreground">
              Discovered Team Execution Archetypes
            </CardTitle>
            <Badge variant="outline" className="text-2xs font-semibold">
              Behavioral Clustering
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clustering sales execution behaviors across win rate, sales cycle duration, and multi-threading.
          </p>
        </div>

        {/* Archetype Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5">
          {archetypes.map((arch) => {
            const isPositive = arch.revenueCorrelationScore > 0;

            return (
              <div
                key={arch.id}
                className="p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{arch.name}</h4>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        {arch.repCount} {arch.repCount === 1 ? 'Rep' : 'Reps'} ({arch.percentageOfTeam}% of team)
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-3xs font-mono font-bold ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      }`}
                    >
                      {isPositive ? '+' : ''}{arch.revenueCorrelationScore.toFixed(2)} Corr
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {arch.description}
                  </p>

                  {/* Archetype Stats */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-card border border-border/40 text-xs">
                    <div>
                      <span className="text-3xs text-muted-foreground block">Avg Win Rate</span>
                      <span className="font-bold text-foreground font-mono">{arch.averageWinRate}%</span>
                    </div>
                    <div>
                      <span className="text-3xs text-muted-foreground block">Avg Cycle</span>
                      <span className="font-bold text-foreground font-mono">{arch.averageCycleDays} days</span>
                    </div>
                  </div>

                  {/* Key Behaviors */}
                  <div className="space-y-1.5">
                    <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground block">
                      Key Execution Patterns
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {arch.keyBehaviors.map((beh, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-3xs font-medium bg-muted/40 text-foreground border-border/40"
                        >
                          {beh}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {arch.recommendedShift && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-2xs space-y-1">
                    <span className="font-semibold text-primary block">Recommended Coaching Shift</span>
                    <p className="text-muted-foreground">{arch.recommendedShift}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
