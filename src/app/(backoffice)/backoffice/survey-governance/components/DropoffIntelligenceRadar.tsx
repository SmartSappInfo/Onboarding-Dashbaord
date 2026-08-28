/**
 * @fileoverview Drop-off Intelligence Radar Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Highlights high-friction survey questions causing high drop-off rates across tenant forms.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { TrendingDown, HelpCircle, CheckCircle2, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SurveyDropoffInsight } from '@/lib/backoffice/backoffice-types';

interface DropoffIntelligenceRadarProps {
  readonly dropoffs: SurveyDropoffInsight[];
}

export default function DropoffIntelligenceRadar({ dropoffs }: DropoffIntelligenceRadarProps) {
  if (dropoffs.length === 0) {
    return (
      <div className="p-12 rounded-2xl border border-border bg-card text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">Zero High-Friction Dropoff Points</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          All tenant surveys and dynamic forms are converting smoothly across steps.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {dropoffs.map((item) => (
        <Card key={item.surveyId} className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground line-clamp-1">{item.organizationName}</span>
            <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold">
              {item.dropoffRate.toFixed(1)}% Drop-off
            </Badge>
          </div>

          <div>
            <h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">{item.surveyTitle}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {item.completedSessions} completed of {item.totalSessions} started sessions
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-bold flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-amber-500" />
                Friction Step #{item.dropoffStepIndex}
              </span>
              <span className="font-mono text-rose-500 font-bold">Abandonment Point</span>
            </div>
            <p className="text-foreground/90 font-medium">{item.dropoffQuestionLabel}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
