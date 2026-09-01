'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 6: Survey Activity Timeline Card
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Rich Activity Stream Display:
 *    - Renders survey submission cards inside CRM entity & contact activity streams.
 * 2. Sentiment & Score Telemetry:
 *    - Displays score gauges, sentiment polarity badges, and key answer highlights.
 * 3. Mobile Ergonomics & Tactile Feedback:
 *    - Standard min-h-[44px] touch targets, active:scale-[0.97] on review action button.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { SurveyActivityTimelinePayload } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileCheck2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SurveyActivityTimelineCardProps {
  activity: SurveyActivityTimelinePayload;
  className?: string;
}

export function SurveyActivityTimelineCard({
  activity,
  className,
}: SurveyActivityTimelineCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isDetractor = (activity.score ?? 100) <= 50 || (activity.percentageScore ?? 100) <= 50;
  const isPromoter = (activity.score ?? 0) >= 80 || (activity.percentageScore ?? 0) >= 80;

  return (
    <Card
      className={cn(
        'rounded-2xl border transition-all duration-300 shadow-sm overflow-hidden',
        isDetractor
          ? 'border-rose-200 bg-rose-500/[0.02] dark:border-rose-950 dark:bg-rose-950/10'
          : isPromoter
          ? 'border-emerald-200 bg-emerald-500/[0.02] dark:border-emerald-950 dark:bg-emerald-950/10'
          : 'border-border bg-card',
        className
      )}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'p-2 rounded-xl shrink-0',
                isDetractor
                  ? 'bg-rose-500/10 text-rose-600'
                  : isPromoter
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {activity.surveyTitle}
                </CardTitle>
                {activity.surveyVersion && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    v{activity.surveyVersion}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-[10px] sm:text-xs text-muted-foreground">
                Submitted {activity.submittedAt ? format(new Date(activity.submittedAt), 'PPP p') : 'Recently'} &bull; Channel: {activity.channel || 'web'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activity.score !== undefined && (
              <Badge
                className={cn(
                  'font-mono text-xs font-bold',
                  isDetractor
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : isPromoter
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-muted text-foreground'
                )}
              >
                Score: {activity.score}/{activity.maxScore || 100}
              </Badge>
            )}

            {activity.sentimentPolarity && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  activity.sentimentPolarity === 'positive' || activity.sentimentPolarity === 'mostly_positive'
                    ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                    : activity.sentimentPolarity === 'negative' || activity.sentimentPolarity === 'mostly_negative'
                    ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                    : 'border-border text-muted-foreground'
                )}
              >
                {activity.sentimentPolarity.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-3">
        {/* Answer Highlights */}
        {activity.answerHighlights && activity.answerHighlights.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-all active:scale-[0.97]"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isExpanded ? 'Hide' : 'Show'} Key Responses ({activity.answerHighlights.length})
            </button>

            {isExpanded && (
              <div className="grid grid-cols-1 gap-2 pt-1">
                {activity.answerHighlights.map((ans, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-0.5">
                    <span className="text-[11px] font-bold text-foreground block">{ans.questionTitle}</span>
                    <p className="text-[11px] text-muted-foreground italic">&ldquo;{ans.answerValue}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <Button asChild size="sm" variant="outline" className="h-9 px-3.5 text-xs font-semibold gap-1.5 active:scale-[0.97]">
            <Link href={activity.reviewUrl}>
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              View Full Response
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
