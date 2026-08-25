'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Vote,
  Clock,
  Calendar,
  CheckCircle2,
  Users,
  Award,
  Check,
  HelpCircle,
  X,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitPollVoteAction } from '@/app/actions/meeting-poll-actions';
import type { MeetingPoll, MeetingPollVote, PollVoteChoice } from '@/lib/meetings/types/polls';
import { format } from 'date-fns';

interface PublicPollClientProps {
  initialPoll: MeetingPoll;
  initialVotes?: MeetingPollVote[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function PublicPollClient({ initialPoll, initialVotes = [] }: PublicPollClientProps) {
  const { toast } = useToast();

  const [poll, setPoll] = React.useState<MeetingPoll>(initialPoll);
  const [voterName, setVoterName] = React.useState('');
  const [voterEmail, setVoterEmail] = React.useState('');
  const [comments, setComments] = React.useState('');
  const [slotVotes, setSlotVotes] = React.useState<Record<string, PollVoteChoice>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  // Initialize votes as 'yes' for ease of voting
  React.useEffect(() => {
    const initialChoices: Record<string, PollVoteChoice> = {};
    for (const slot of initialPoll.proposedSlots) {
      initialChoices[slot.id] = 'yes';
    }
    setSlotVotes(initialChoices);
  }, [initialPoll]);

  const handleVoteChoice = (slotId: string, choice: PollVoteChoice) => {
    setSlotVotes(prev => ({ ...prev, [slotId]: choice }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voterName.trim() || !voterEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name & Email required',
        description: 'Please provide your name and email to cast your vote.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPollVoteAction({
        pollId: poll.id,
        voterName: voterName.trim(),
        voterEmail: voterEmail.trim(),
        slotVotes,
        comments: comments.trim() || undefined,
      });

      if (res.success) {
        setIsSubmitted(true);
        toast({
          title: 'Vote Submitted!',
          description: 'Thank you for your response. The host will confirm the final time.',
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* Header Card */}
        <Card className="rounded-3xl border shadow-sm overflow-hidden">
          <CardHeader className="p-6 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-b">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Vote className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{poll.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Hosted by <strong>{poll.hostName}</strong> • {poll.durationMinutes} mins
                  </CardDescription>
                </div>
              </div>

              <Badge
                variant="secondary"
                className={`text-[10px] uppercase font-bold ${
                  poll.status === 'open' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                }`}
              >
                {poll.status}
              </Badge>
            </div>

            {poll.description && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                {poll.description}
              </p>
            )}
          </CardHeader>

          <CardContent className="p-6">
            {isSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">Your availability has been recorded!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  We'll notify you at <strong>{voterEmail}</strong> as soon as {poll.hostName} selects the winning time slot.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Voter Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Your Name *</Label>
                    <Input
                      required
                      value={voterName}
                      onChange={e => setVoterName(e.target.value)}
                      placeholder="Jane Doe"
                      className="rounded-xl min-h-[44px] text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Your Email *</Label>
                    <Input
                      type="email"
                      required
                      value={voterEmail}
                      onChange={e => setVoterEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="rounded-xl min-h-[44px] text-xs"
                    />
                  </div>
                </div>

                {/* Candidate Slots Matrix */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Select Which Times Work For You
                  </Label>

                  <div className="space-y-2">
                    {poll.proposedSlots.map(slot => {
                      const currentChoice = slotVotes[slot.id] || 'yes';

                      return (
                        <div
                          key={slot.id}
                          className="p-3.5 rounded-2xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground block">
                              {format(new Date(slot.startAt), 'EEEE, MMMM d')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-primary" />
                              {format(new Date(slot.startAt), 'p')} – {format(new Date(slot.endAt), 'p')}
                            </span>
                          </div>

                          {/* Choice Triad */}
                          <div className="grid grid-cols-3 gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleVoteChoice(slot.id, 'yes')}
                              className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.97] ${
                                currentChoice === 'yes'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Yes
                            </button>

                            <button
                              type="button"
                              onClick={() => handleVoteChoice(slot.id, 'maybe')}
                              className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.97] ${
                                currentChoice === 'maybe'
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                              Maybe
                            </button>

                            <button
                              type="button"
                              onClick={() => handleVoteChoice(slot.id, 'no')}
                              className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.97] ${
                                currentChoice === 'no'
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" />
                              No
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs font-semibold">Optional Note to Host</Label>
                  <Textarea
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    placeholder="Any comments, constraints or preferred alternatives..."
                    className="rounded-xl min-h-[60px] text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl min-h-[48px] text-sm font-bold gap-2 shadow-sm active:scale-[0.97]"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? 'Submitting Vote...' : 'Submit Availability'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
