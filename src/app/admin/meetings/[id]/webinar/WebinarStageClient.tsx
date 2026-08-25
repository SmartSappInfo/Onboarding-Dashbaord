'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Radio,
  Users,
  Hand,
  MessageSquare,
  ThumbsUp,
  UserPlus,
  Play,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getWebinarStageStateAction,
  togglePresenterStageStatusAction,
  postWebinarQuestionAction,
  upvoteWebinarQuestionAction,
  promoteWaitlistRegistrantsAction,
} from '@/app/actions/webinar-stage-actions';
import type {
  WebinarStageState,
  WebinarPresenter,
  WebinarQuestion,
} from '@/lib/meetings/types/webinar-stage';
import Link from 'next/link';

interface WebinarStageClientProps {
  meetingId: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function WebinarStageClient({ meetingId }: WebinarStageClientProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [state, setState] = React.useState<WebinarStageState | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [newQuestionText, setNewQuestionText] = React.useState('');
  const [isPostingQ, setIsPostingQ] = React.useState(false);
  const [isPromotingWaitlist, setIsPromotingWaitlist] = React.useState(false);

  const fetchStage = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await getWebinarStageStateAction(meetingId, activeWorkspaceId);
      if (res.success && res.state) {
        setState(res.state);
      }
    } catch (err) {
      console.warn('[fetchStage]', err);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, activeWorkspaceId]);

  React.useEffect(() => {
    fetchStage();
    // Poll state every 10 seconds during broadcast
    const interval = setInterval(fetchStage, 10000);
    return () => clearInterval(interval);
  }, [fetchStage]);

  const handleToggleStage = async (userId: string, currentStatus: string) => {
    if (!activeWorkspaceId) return;
    const newStatus = currentStatus === 'on_stage' ? 'backstage' : 'on_stage';
    try {
      const res = await togglePresenterStageStatusAction(meetingId, activeWorkspaceId, userId, newStatus);
      if (res.success) {
        toast({ title: `Presenter moved to ${newStatus.replace('_', ' ')}` });
        fetchStage();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Action failed', description: getErrorMessage(err) });
    }
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !activeWorkspaceId) return;

    setIsPostingQ(true);
    try {
      const res = await postWebinarQuestionAction(
        meetingId,
        activeWorkspaceId,
        'moderator',
        'Moderator Host',
        newQuestionText.trim()
      );

      if (res.success) {
        toast({ title: 'Question added to Q&A queue' });
        setNewQuestionText('');
        fetchStage();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to post', description: getErrorMessage(err) });
    } finally {
      setIsPostingQ(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      const res = await upvoteWebinarQuestionAction(questionId, 'moderator');
      if (res.success) {
        fetchStage();
      }
    } catch (err) {
      console.warn('[upvote]', err);
    }
  };

  const handlePromoteWaitlist = async () => {
    if (!activeWorkspaceId || !state) return;
    setIsPromotingWaitlist(true);
    try {
      const res = await promoteWaitlistRegistrantsAction(
        meetingId,
        activeWorkspaceId,
        state.capacityLimit
      );
      if (res.success) {
        toast({
          title: 'Waitlist Promoted!',
          description: `Successfully confirmed ${res.promotedCount || 0} waitlisted registrants.`,
        });
        fetchStage();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Promotion failed', description: getErrorMessage(err) });
    } finally {
      setIsPromotingWaitlist(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    );
  }

  const presenters = state?.presenters || [];
  const raisedHands = state?.raisedHands || [];
  const questions = state?.questions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/admin/meetings/${meetingId}`}>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Radio className="h-5 w-5 text-rose-500 animate-pulse" />
              Live Webinar & Broadcast Stage
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time backstage moderation, speaker stage assignments, raised hands, and Q&A queue.
            </p>
          </div>
        </div>

        {/* Capacity & Waitlist Controls */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1.5 rounded-xl">
            <Users className="h-3.5 w-3.5 mr-1.5 text-primary" />
            {state?.totalAttending || 0} Live / {state?.capacityLimit || 100} Max Capacity
          </Badge>

          {state && state.waitlistedCount > 0 && (
            <Button
              size="sm"
              onClick={handlePromoteWaitlist}
              disabled={isPromotingWaitlist}
              className="rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Promote Waitlist ({state.waitlistedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Main 3-Column Broadcast Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Presenters & Stage Management */}
        <Card className="rounded-3xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Speakers & Stage Roster</h3>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {presenters.length} Presenters
            </Badge>
          </div>

          <div className="space-y-2.5">
            {presenters.map(p => (
              <div
                key={p.userId}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  p.status === 'on_stage' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/20'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{p.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold ${
                        p.status === 'on_stage' ? 'bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground'
                      }`}
                    >
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{p.role.replace('_', ' ')}</span>
                </div>

                <Button
                  size="sm"
                  variant={p.status === 'on_stage' ? 'secondary' : 'default'}
                  onClick={() => handleToggleStage(p.userId, p.status)}
                  className="rounded-xl h-8 text-xs font-semibold active:scale-[0.97]"
                >
                  {p.status === 'on_stage' ? 'Move Backstage' : 'Bring to Stage'}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Col 2: Raised Hands Queue */}
        <Card className="rounded-3xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Hand className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-sm text-foreground">Raised Hands Queue</h3>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {raisedHands.length} Waiting
            </Badge>
          </div>

          <div className="space-y-2.5">
            {raisedHands.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center">
                No attendees currently raising their hands.
              </p>
            ) : (
              raisedHands.map(h => (
                <div
                  key={h.participantId}
                  className="p-3.5 rounded-2xl border bg-amber-500/5 border-amber-500/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">{h.participantName}</span>
                    <span className="text-[10px] text-muted-foreground">Attendee</span>
                  </div>

                  <Button size="sm" className="rounded-xl h-8 text-xs font-semibold active:scale-[0.97]">
                    Invite to Speak
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Col 3: Audience Q&A Moderation */}
        <Card className="rounded-3xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Live Audience Q&A</h3>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {questions.length} Questions
            </Badge>
          </div>

          {/* Post Question Input */}
          <form onSubmit={handlePostQuestion} className="flex gap-2">
            <Input
              value={newQuestionText}
              onChange={e => setNewQuestionText(e.target.value)}
              placeholder="Ask or pin a question..."
              className="rounded-xl text-xs h-9"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isPostingQ}
              className="rounded-xl h-9 text-xs active:scale-[0.97]"
            >
              Post
            </Button>
          </form>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {questions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No audience questions submitted yet.
              </p>
            ) : (
              questions.map(q => (
                <div
                  key={q.id}
                  className="p-3 rounded-2xl border bg-muted/20 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{q.questionText}</p>
                    <span className="text-[10px] text-muted-foreground block">
                      Asked by {q.participantName}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpvote(q.id)}
                    className="h-8 rounded-xl px-2 gap-1 text-xs text-primary"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {q.upvotesCount}
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
