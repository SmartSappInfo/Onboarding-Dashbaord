'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Smile,
  Meh,
  Frown,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getMeetingFeedbackSummaryAction } from '@/app/actions/meeting-feedback-actions';
import type { MeetingFeedbackSummary } from '@/lib/meetings/types/feedback';
import { format } from 'date-fns';

interface MeetingFeedbackTabProps {
  meetingId: string;
}

export function MeetingFeedbackTab({ meetingId }: MeetingFeedbackTabProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [summary, setSummary] = React.useState<MeetingFeedbackSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const fetchFeedback = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingFeedbackSummaryAction(meetingId, activeWorkspaceId);
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.warn('[fetch feedback]', err);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, activeWorkspaceId]);

  React.useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const publicFeedbackUrl = `${origin}/book/feedback/${meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicFeedbackUrl);
    setCopied(true);
    toast({ title: 'Feedback survey link copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 text-xs">
      {/* Top NPS / CSAT Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Net Promoter Score Card */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground">Net Promoter Score (NPS)</span>
          <div className="text-3xl font-bold text-foreground">
            {summary?.npsScore !== undefined ? (
              <span className={summary.npsScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {summary.npsScore > 0 ? `+${summary.npsScore}` : summary.npsScore}
              </span>
            ) : (
              'N/A'
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Range: -100 to +100</p>
        </Card>

        {/* Promoters */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Promoters (9-10)</span>
            <Smile className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {summary?.promotersCount || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">Loyal enthusiasts</p>
        </Card>

        {/* Passives */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Passives (7-8)</span>
            <Meh className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {summary?.passivesCount || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">Satisfied but neutral</p>
        </Card>

        {/* Detractors */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Detractors (0-6)</span>
            <Frown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {summary?.detractorsCount || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">At-risk attendees</p>
        </Card>
      </div>

      {/* Share Survey Link Banner */}
      <div className="p-4 rounded-2xl bg-muted/40 border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Collect Post-Meeting Feedback</span>
          <p className="text-[11px] text-muted-foreground">
            Share this link in chat or automated follow-up emails: <code className="text-[10px]">{publicFeedbackUrl}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl h-9 text-xs gap-1.5 active:scale-[0.97]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            Copy Survey Link
          </Button>
          <a href={publicFeedbackUrl} target="_blank" rel="noopener noreferrer">
            <Button size="icon" variant="outline" className="rounded-xl h-9 w-9">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* Individual Feedback Responses List */}
      <Card className="rounded-2xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          Attendee Feedback Submissions ({summary?.totalResponses || 0})
        </div>

        <div className="space-y-2">
          {!summary || summary.responses.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No feedback responses received yet for this meeting.
            </p>
          ) : (
            summary.responses.map(r => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl border bg-muted/20 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {r.participantName || r.participantEmail || 'Anonymous Attendee'}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold uppercase ${
                        r.npsCategory === 'promoter'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : r.npsCategory === 'detractor'
                          ? 'bg-rose-500/10 text-rose-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      Score: {r.score}/10 ({r.npsCategory || 'Rating'})
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(r.submittedAt), 'EEE, MMM d, p')}
                  </span>
                </div>

                {r.feedbackText && (
                  <p className="text-[11px] text-muted-foreground italic bg-background/50 p-2 rounded-lg border">
                    "{r.feedbackText}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
