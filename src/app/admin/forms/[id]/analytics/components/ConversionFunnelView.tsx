'use client';

/**
 * SmartSapp Forms 2.0: Conversion Funnel Visualizer
 * 
 * Renders an interactive multi-stage funnel showing visitor-to-submission
 * progression and step-by-step drop-off percentages.
 */

import React from 'react';
import { Layers, ArrowDown, Users, ChevronRight, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { FormFunnelStage } from '@/lib/forms/form-analytics-types';

interface ConversionFunnelViewProps {
  stages: FormFunnelStage[];
}

export default function ConversionFunnelView({ stages = [] }: ConversionFunnelViewProps) {
  if (stages.length === 0) return null;

  return (
    <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Conversion Funnel & Drop-Off Steps
            </CardTitle>
            <CardDescription className="text-xs">
              Step-by-step progression from initial form view to final verified submission.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase bg-primary/5 text-primary border-primary/20">
            {stages.length} Funnel Stages
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-foreground">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-foreground text-sm">
                      {stage.count.toLocaleString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        isLast
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : isFirst
                          ? "bg-muted text-muted-foreground"
                          : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      )}
                    >
                      {stage.overallConversionRate}% of visitors
                    </Badge>
                  </div>
                </div>

                <div className="relative">
                  <Progress
                    value={stage.overallConversionRate}
                    className={cn(
                      "h-3 rounded-full bg-muted/40",
                      isLast && "[&>div]:bg-emerald-500",
                      !isLast && "[&>div]:bg-primary"
                    )}
                  />
                </div>

                {!isLast && stage.stepDropOffRate > 0 && (
                  <div className="flex items-center justify-end gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium pr-1">
                    <TrendingDown className="h-3 w-3" />
                    <span>{stage.stepDropOffRate}% drop-off to next step</span>
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
