'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — CRM Entity 360 Surveys Tab
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. 360-Degree Survey History: Displays all survey responses, score trends, and sentiment.
 * 2. Real-time Survey Dispatch Modal trigger.
 * 3. Mobile ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Entity, WorkspaceEntity, EntityContact } from '@/lib/types';
import {
  getEntitySurveyHistoryAction,
  type EntitySurveyHistorySummary,
  type EntitySurveyHistoryItem,
} from '@/lib/surveys/survey-crm-trigger-actions';
import { SendSurveyModal } from './SendSurveyModal';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  FileQuestion,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntitySurveysTabProps {
  entity: Entity | WorkspaceEntity;
  workspaceEntity?: WorkspaceEntity | null;
  workspaceId?: string;
}

export default function EntitySurveysTab({
  entity,
  workspaceEntity,
  workspaceId,
}: EntitySurveysTabProps) {
  const activeWsId = workspaceId || workspaceEntity?.workspaceId || '';
  const entityId = entity.id;
  const rawEntity = entity as unknown as Record<string, unknown>;
  const entityName =
    (typeof rawEntity.name === 'string' && rawEntity.name) ||
    (typeof rawEntity.schoolData === 'object' && rawEntity.schoolData && typeof (rawEntity.schoolData as Record<string, unknown>).name === 'string' ? String((rawEntity.schoolData as Record<string, unknown>).name) : '') ||
    'Entity';

  const [historySummary, setHistorySummary] = React.useState<EntitySurveyHistorySummary>({
    responses: [],
    totalCount: 0,
    averageScore: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSendModalOpen, setIsSendModalOpen] = React.useState(false);
  const [expandedResponseId, setExpandedResponseId] = React.useState<string | null>(null);

  const fetchHistory = React.useCallback(async () => {
    if (!entityId || !activeWsId) return;
    setIsLoading(true);
    try {
      const res = await getEntitySurveyHistoryAction(entityId, activeWsId);
      if (res.success && res.data) {
        setHistorySummary(res.data);
      }
    } catch (err) {
      console.error('[EntitySurveysTab] Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, activeWsId]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const contacts: EntityContact[] = React.useMemo(() => {
    const rawEntityRecord = entity as unknown as Record<string, unknown>;
    return Array.isArray(rawEntityRecord.contacts) ? (rawEntityRecord.contacts as EntityContact[]) : [];
  }, [entity]);

  const getSentimentIcon = (sentiment?: string) => {
    if (sentiment === 'positive' || sentiment === 'mostly_positive') {
      return <Smile className="h-4 w-4 text-emerald-500" />;
    }
    if (sentiment === 'negative' || sentiment === 'mostly_negative') {
      return <Frown className="h-4 w-4 text-rose-500" />;
    }
    return <Meh className="h-4 w-4 text-amber-500" />;
  };

  const getScoreColor = (percentage?: number) => {
    if (percentage === undefined) return 'text-muted-foreground';
    if (percentage >= 80) return 'text-emerald-600 bg-emerald-500/10 border-emerald-300';
    if (percentage >= 60) return 'text-amber-600 bg-amber-500/10 border-amber-300';
    return 'text-rose-600 bg-rose-500/10 border-rose-300';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Primary CTA */}
      <Card className="rounded-2xl border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              Surveys & Experience Intelligence
              <Badge variant="outline" className="text-[10px] font-mono">
                {historySummary.totalCount} Responses
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Track customer satisfaction, NPS feedback, and dispatch real-time survey invitations.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => setIsSendModalOpen(true)}
            className="h-10 px-4 gap-2 text-xs font-bold rounded-xl active:scale-[0.97] min-h-[44px] shrink-0"
          >
            <Send className="h-4 w-4" />
            Send Survey
          </Button>
        </CardHeader>

        {/* 4 KPI Summary Cards */}
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Submissions
              </span>
              <p className="text-2xl font-black text-foreground">{historySummary.totalCount}</p>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Avg Satisfaction
              </span>
              <p className="text-2xl font-black text-foreground">
                {historySummary.averageScore > 0 ? `${historySummary.averageScore}%` : 'N/A'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Latest Sentiment
              </span>
              <div className="flex items-center gap-1.5 pt-1">
                {getSentimentIcon(historySummary.latestSentiment)}
                <span className="text-sm font-bold capitalize text-foreground">
                  {historySummary.latestSentiment?.replace('_', ' ') || 'Neutral'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Last Submission
              </span>
              <p className="text-xs font-semibold text-foreground pt-1 truncate">
                {historySummary.latestSubmittedAt
                  ? format(parseISO(historySummary.latestSubmittedAt), 'MMM d, yyyy')
                  : 'No submissions yet'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Survey Responses History List */}
      <Card className="rounded-2xl border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Response Telemetry & Verbatim Feedback
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground">Loading survey history...</p>
            </div>
          ) : historySummary.responses.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-border rounded-2xl p-6 bg-muted/5">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FileQuestion className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">No Survey Feedback Recorded</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  This entity has not yet completed any surveys. Dispatch an invitation to gather feedback.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setIsSendModalOpen(true)}
                className="h-9 px-4 gap-2 text-xs font-semibold rounded-xl active:scale-[0.97]"
              >
                <Send className="h-4 w-4" />
                Dispatch First Survey
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {historySummary.responses.map((resp) => {
                const isExpanded = expandedResponseId === resp.id;

                return (
                  <div
                    key={resp.id}
                    className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">
                            {resp.surveyTitle}
                          </span>
                          {resp.percentage !== undefined && (
                            <Badge variant="outline" className={cn('text-xs font-mono font-bold', getScoreColor(resp.percentage))}>
                              {resp.score}/{resp.maxScore || 100} ({resp.percentage}%)
                            </Badge>
                          )}
                          {resp.sentiment && (
                            <Badge variant="secondary" className="text-[10px] font-semibold capitalize gap-1">
                              {getSentimentIcon(resp.sentiment)}
                              {resp.sentiment.replace('_', ' ')}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            via {resp.channel || 'web'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Respondent: <strong className="text-foreground">{resp.respondentName || 'Anonymous'}</strong></span>
                          <span>&bull;</span>
                          <span>{format(parseISO(resp.submittedAt), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedResponseId(isExpanded ? null : resp.id)}
                          className="h-8 px-2.5 text-xs font-semibold gap-1 active:scale-[0.97]"
                        >
                          {isExpanded ? (
                            <>
                              Hide Answers <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              View Answers <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Button>

                        <Link
                          href={`/admin/surveys/${resp.surveyId}/results/${resp.id}`}
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted/40 transition-colors active:scale-[0.97]"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>

                    {/* Expandable Answers Section */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-2 bg-muted/10 p-3 rounded-lg">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                          Submitted Question Answers ({resp.answers.length})
                        </span>
                        {resp.answers.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No detailed question answers recorded.</p>
                        ) : (
                          resp.answers.map((ans, i) => (
                            <div key={i} className="text-xs space-y-0.5">
                              <span className="text-muted-foreground font-medium">
                                Q{i + 1}: {ans.questionTitle || ans.questionId}
                              </span>
                              <p className="font-semibold text-foreground bg-card p-2 rounded-md border border-border/50">
                                {Array.isArray(ans.value)
                                  ? ans.value.join(', ')
                                  : typeof ans.value === 'object'
                                  ? JSON.stringify(ans.value)
                                  : String(ans.value)}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Survey Modal */}
      <SendSurveyModal
        open={isSendModalOpen}
        onOpenChange={setIsSendModalOpen}
        entityId={entityId}
        entityName={entityName}
        contacts={contacts}
        workspaceId={activeWsId}
        onSent={fetchHistory}
      />
    </div>
  );
}
