'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Response Quality & Integrity Audit Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Evaluates response dataset for data integrity, speeders (< 15s), and straight-liners.
 * 2. Computes dynamic Data Reliability Score (0 to 100).
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { computeResponseQualityMetrics, type ResponseQualityMetrics } from '@/lib/surveys/survey-analytics-engine';
import { ShieldCheck, Zap, Clock, AlertTriangle, CheckCircle2, Award } from 'lucide-react';

export interface ResponseQualityTabProps {
  survey: Survey;
  responses: SurveyResponse[];
}

export function ResponseQualityTab({ survey, responses }: ResponseQualityTabProps) {
  const quality = React.useMemo(() => {
    return computeResponseQualityMetrics(responses);
  }, [responses]);

  return (
    <div className="space-y-6">
      {/* Top Level Integrity Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Data Reliability</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{quality.reliabilityScore} / 100</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            {quality.reliabilityScore >= 80 ? 'High Confidence Data' : 'Review Low-Effort Entries'}
          </span>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Median Duration</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">
            {quality.medianDurationSeconds > 0 ? `${quality.medianDurationSeconds}s` : '—'}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Avg: {quality.averageDurationSeconds}s per respondent
          </span>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Speeders Detected</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{quality.speedersCount}</p>
          <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
            {quality.speedersPercentage}% under 15 seconds
          </span>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Straight-Liners</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{quality.straightLinersCount}</p>
          <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
            {quality.straightLinersPercentage}% repetitive answers
          </span>
        </Card>
      </div>

      {/* Detailed Quality Assessment */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Research Data Quality Audit</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Automated heuristics filter out non-engaged respondents and protect statistical validity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> High-Engagement Thoughtful Responses
                </span>
                <span className="font-mono text-emerald-600">
                  {100 - quality.speedersPercentage - quality.straightLinersPercentage}%
                </span>
              </div>
              <Progress
                value={Math.max(0, 100 - quality.speedersPercentage - quality.straightLinersPercentage)}
                className="h-2 rounded-full"
              />
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" /> Fast Completions (&lt; 15 seconds)
                </span>
                <span className="font-mono text-amber-600">{quality.speedersPercentage}%</span>
              </div>
              <Progress value={quality.speedersPercentage} className="h-2 rounded-full" />
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> Straight-Lining / Flat Responses
                </span>
                <span className="font-mono text-rose-600">{quality.straightLinersPercentage}%</span>
              </div>
              <Progress value={quality.straightLinersPercentage} className="h-2 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
