'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Funnel & Friction Analytics Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visualizes respondent progression from outreach to final submission using real survey session telemetry.
 * 2. Identifies step friction drop-off points with computeFunnelData & computeDropoffInsights.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyResponse, SurveySession } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { computeFunnelData, computeDropoffInsights, type FunnelStep } from '@/lib/survey-analytics-utils';
import { Filter, TrendingDown, ArrowDown, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

export interface FunnelDropoffTabProps {
  survey: Survey;
  responses: SurveyResponse[];
  sessions?: SurveySession[];
}

export function FunnelDropoffTab({ survey, responses, sessions = [] }: FunnelDropoffTabProps) {
  // Use real session tracking data when available
  const funnelSteps: FunnelStep[] = React.useMemo(() => {
    if (sessions.length > 0) {
      return computeFunnelData(survey, sessions);
    }

    // Fallback based on survey structure and completion numbers
    const elements = survey.elements || [];
    const stepList: { id: string; title: string; count: number }[] = [];

    let currentStepTitle = 'Introduction';
    let currentQCount = 0;

    elements.forEach((el) => {
      if (el.type === 'section') {
        if (currentQCount > 0 || stepList.length === 0) {
          stepList.push({
            id: el.id,
            title: el.title || currentStepTitle,
            count: responses.length,
          });
        }
        currentStepTitle = el.title || `Step ${stepList.length + 1}`;
        currentQCount = 0;
      } else if ('isRequired' in el) {
        currentQCount++;
      }
    });

    stepList.push({
      id: 'final_step',
      title: currentStepTitle,
      count: responses.length,
    });

    const totalCompletions = responses.length;

    return stepList.map((step, idx) => {
      const percentage = totalCompletions > 0 ? 100 : 0;
      return {
        index: idx,
        label: step.title,
        count: totalCompletions,
        percentage,
        color: '#3b82f6',
      };
    });
  }, [survey, sessions, responses.length]);

  const dropoffInsights = React.useMemo(() => {
    return computeDropoffInsights(funnelSteps);
  }, [funnelSteps]);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Funnel & Step Friction Analytics</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Understand step-by-step respondent traversal and isolate question fatigue or drop-off points.
                </CardDescription>
              </div>
            </div>

            {sessions.length > 0 && (
              <Badge variant="outline" className="text-xs font-mono">
                {sessions.length} Recorded Sessions
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            {funnelSteps.map((step, idx) => {
              const insight = dropoffInsights.find((d) => d.from === step.label);

              return (
                <div key={step.index} className="space-y-2">
                  {insight && insight.lost > 0 && (
                    <div className="flex items-center justify-center gap-2 py-1 text-xs text-rose-500 font-semibold">
                      <ArrowDown className="h-3.5 w-3.5" />
                      <span>{insight.lost} respondents dropped off ({Math.round(insight.lossPercentage)}% friction loss)</span>
                    </div>
                  )}

                  <div className="p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                          Step {idx + 1}
                        </span>
                        <span className="font-bold text-foreground">{step.label}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-foreground text-sm">{Math.round(step.percentage)}%</span>
                        <span className="text-muted-foreground text-[10px] block">{step.count} respondents</span>
                      </div>
                    </div>

                    <Progress value={step.percentage} className="h-2 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
