'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Smile, Meh, Frown, CheckCircle2, Sparkles, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitPublicMeetingFeedbackAction } from '@/app/actions/meeting-feedback-actions';

interface PublicFeedbackClientProps {
  meetingId: string;
  meetingTitle?: string;
  hostName?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function PublicFeedbackClient({
  meetingId,
  meetingTitle = 'Your Session',
  hostName = 'SmartSapp Host',
}: PublicFeedbackClientProps) {
  const { toast } = useToast();

  const [score, setScore] = React.useState<number | null>(null);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [participantName, setParticipantName] = React.useState('');
  const [participantEmail, setParticipantEmail] = React.useState('');
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === null) {
      toast({
        variant: 'destructive',
        title: 'Rating required',
        description: 'Please select a score from 0 to 10.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPublicMeetingFeedbackAction({
        meetingId,
        participantName: participantName.trim() || undefined,
        participantEmail: participantEmail.trim() || undefined,
        ratingType: 'nps',
        score,
        feedbackText: feedbackText.trim() || undefined,
      });

      if (res.success) {
        setIsSubmitted(true);
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border shadow-xl p-8 text-center space-y-4">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Thank You For Your Feedback!</h2>
          <p className="text-xs text-muted-foreground">
            Your review helps us continuously improve our meeting experience with {hostName}.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full rounded-3xl border shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 rounded-full">
            Post-Meeting Survey
          </Badge>
          <h1 className="text-xl font-bold text-foreground">{meetingTitle}</h1>
          <p className="text-xs text-muted-foreground">
            How likely are you to recommend {hostName} and SmartSapp to a colleague?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NPS 0-10 Rating Scale */}
          <div className="space-y-2">
            <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
              {Array.from({ length: 11 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center ${
                    score === i
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold px-1">
              <span>0 - Not Likely</span>
              <span>10 - Extremely Likely</span>
            </div>
          </div>

          {/* Feedback Comments */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">What was the highlight or area for improvement?</Label>
            <Textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Tell us what you thought about the session..."
              className="rounded-2xl min-h-[90px] text-xs"
            />
          </div>

          {/* Contact Details (Optional) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Your Name (Optional)</Label>
              <Input
                value={participantName}
                onChange={e => setParticipantName(e.target.value)}
                placeholder="Jane Doe"
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Your Email (Optional)</Label>
              <Input
                type="email"
                value={participantEmail}
                onChange={e => setParticipantEmail(e.target.value)}
                placeholder="jane@example.com"
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || score === null}
            className="w-full rounded-2xl min-h-[46px] text-xs font-semibold gap-2 active:scale-[0.97]"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Submitting Review...' : 'Submit Feedback'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
