'use client';

/**
 * @fileoverview Pipeline Stage Conversion Funnel Component
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 51 & UI Section 36):
 * - Visualizes stage-to-stage progression rates (e.g. Qualification 100% -> Discovery 72% -> Proposal 38% -> Won 27%).
 * - Displays drop-off badges highlighting where deal leaks occur in the pipeline.
 * - Compares average days spent in each stage against stage target SLAs.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Mobile responsive horizontal layout with minimum 44px touch targets.
 * - Dynamic multi-currency formatting.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency-utils';
import type { StageFunnelStep } from '@/lib/types';
import { 
  ArrowRight, 
  Clock, 
  TrendingDown, 
  Layers, 
  AlertTriangle 
} from 'lucide-react';

interface StageConversionFunnelProps {
  funnelSteps: StageFunnelStep[];
  currency?: string;
}

export default function StageConversionFunnel({
  funnelSteps,
  currency = 'GHS',
}: StageConversionFunnelProps) {
  if (!funnelSteps || funnelSteps.length === 0) {
    return (
      <Card className="rounded-3xl border-border/80 bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col items-center justify-center gap-3 opacity-40">
          <Layers className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-bold">No stage conversion data available</p>
          <p className="text-xs text-muted-foreground">Add stages and deals to view conversion funnel metrics.</p>
        </div>
      </Card>
    );
  }

  const maxEntered = Math.max(...funnelSteps.map(s => s.dealsEntered), 1);

  return (
    <Card className="rounded-3xl border-border/80 bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-5 md:p-6 border-b border-border/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg">
                Funnel Velocity
              </Badge>
            </div>
            <CardTitle className="text-lg font-black tracking-tight text-foreground">
              Stage Conversion & Retention Funnel
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Stage-by-stage conversion efficiency, drop-off attrition, and average stage durations.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="space-y-3">
          {funnelSteps.map((step, idx) => {
            const isLast = idx === funnelSteps.length - 1;
            const barWidthPercent = Math.max(12, Math.round((step.dealsEntered / maxEntered) * 100));
            const isSlaBreached = Boolean(step.slaDays && step.avgDaysInStage > step.slaDays * 1.5);

            return (
              <div key={step.stageId} className="space-y-1.5 group">
                {/* Stage Header Info */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: step.stageColor }}
                    />
                    <span className="font-bold text-foreground">{step.stageName}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      ({step.dealsEntered} deals · {formatCurrency(step.totalValue, currency)})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Stage SLA & Average Days */}
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{step.avgDaysInStage}d avg</span>
                      {step.slaDays && (
                        <span className={`text-[10px] ${isSlaBreached ? 'text-amber-500 font-bold' : 'opacity-70'}`}>
                          (SLA: {step.slaDays}d)
                        </span>
                      )}
                      {isSlaBreached && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-0.5" />
                      )}
                    </div>

                    {/* Conversion % */}
                    <Badge
                      variant="outline"
                      className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                        step.conversionRate >= 70
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : step.conversionRate >= 40
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          : 'bg-muted text-muted-foreground border-border/80'
                      }`}
                    >
                      {step.conversionRate}% Retention
                    </Badge>
                  </div>
                </div>

                {/* Funnel Horizontal Bar */}
                <div className="h-4 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/40 flex items-center">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: step.stageColor,
                      opacity: 0.85,
                    }}
                  />
                </div>

                {/* Drop-off connector to next stage */}
                {!isLast && (
                  <div className="flex items-center gap-2 pl-4 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    <span>Next stage progression: <strong>{step.conversionRate}%</strong></span>
                    {step.dropOffRate > 0 && (
                      <span className="flex items-center gap-1 text-red-500 dark:text-red-400 font-bold">
                        <TrendingDown className="h-3 w-3" />
                        {step.dropOffRate}% drop-off
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
