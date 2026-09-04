'use client';

/**
 * @fileoverview Post-Meeting Review & 1-Click CRM Sync Modal (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills UI Specifications Section 27-28 & PRD Section 4023:
 * 1. Post-call sentiment rating (Positive / Neutral / Challenging).
 * 2. Deterministic AI extraction of buying signals, objections, and commitments.
 * 3. 1-Click CRM auto-sync: advances deal stage, creates follow-up tasks, and drafts follow-up email.
 * 4. Awards +20 effort points via Phase 1 scoring engine.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  Loader2,
  Send,
  Zap,
} from 'lucide-react';
import type { MeetingBrief, PostMeetingIntelligence } from '@/lib/deal-intelligence/types';
import { extractPostMeetingIntelligence } from '@/lib/deal-intelligence/deal-intelligence-engine';
import { submitPostMeetingIntelligenceAction } from '@/app/actions/deal-intelligence-actions';

interface PostMeetingReviewDrawerProps {
  meeting: MeetingBrief | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  organizationId: string;
  repId: string;
  repName: string;
  onSuccess?: () => void;
}

export const PostMeetingReviewDrawer: React.FC<PostMeetingReviewDrawerProps> = ({
  meeting,
  isOpen,
  onClose,
  workspaceId,
  organizationId,
  repId,
  repName,
  onSuccess,
}) => {
  const { toast } = useToast();

  const [sentimentRating, setSentimentRating] = React.useState<'positive' | 'neutral' | 'challenging'>('positive');
  const [meetingNotes, setMeetingNotes] = React.useState<string>('');

  const [extractedPreview, setExtractedPreview] = React.useState<PostMeetingIntelligence | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Sync state from meeting brief when drawer opens
  React.useEffect(() => {
    if (meeting) {
      setMeetingNotes(meeting.meetingNotesSummary || '');
      setSentimentRating('positive');
    }
  }, [meeting]);

  // Auto-generate preview when notes or sentiment changes
  React.useEffect(() => {
    if (!meeting) return;
    const preview = extractPostMeetingIntelligence({
      meetingId: meeting.meetingId,
      meetingTitle: meeting.title,
      repId,
      repName,
      notesText: meetingNotes,
      sentimentRating,
      workspaceId,
      organizationId,
      dealId: meeting.dealId,
    });
    setExtractedPreview(preview);
  }, [meeting, meetingNotes, sentimentRating, repId, repName, workspaceId, organizationId]);

  if (!meeting) return null;

  const handleSyncToCrm = async () => {
    if (!meetingNotes.trim()) {
      toast({
        title: 'Meeting Notes Required',
        description: 'Please input key takeaways or commitments before syncing to CRM.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await submitPostMeetingIntelligenceAction({
        meetingId: meeting.meetingId,
        meetingTitle: meeting.title,
        dealId: meeting.dealId,
        workspaceId,
        organizationId,
        repId,
        repName,
        notesText: meetingNotes,
        sentimentRating,
        approvedStageProgression: extractedPreview?.crmSyncDraft.suggestedStageId,
        createFollowUpTasks: true,
      });

      if (res.success) {
        toast({
          title: 'Meeting Synced to CRM (+20 Points)',
          description: `Extracted ${res.postMeeting?.commitmentsMade.length || 0} task(s) and logged intelligence. 20 effort points awarded.`,
          actionConfig: {
            path: '/admin/my-day',
            label: 'View Tasks in My Day',
          },
        });
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Sync Failed',
          description: res.error || 'Failed to complete post-meeting sync.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to communicate with server.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Complete Meeting & Review Intelligence
          </DialogTitle>
          <DialogDescription>
            {meeting.title} • {meeting.accountName || 'Customer Account'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Sentiment Reaction Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">How did the meeting go?</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={sentimentRating === 'positive' ? 'default' : 'outline'}
                onClick={() => setSentimentRating('positive')}
                className="min-h-[44px] flex items-center justify-center gap-2 active:scale-[0.97] text-xs font-semibold"
              >
                <Smile className="w-4 h-4 text-emerald-500" />
                Positive
              </Button>
              <Button
                type="button"
                variant={sentimentRating === 'neutral' ? 'default' : 'outline'}
                onClick={() => setSentimentRating('neutral')}
                className="min-h-[44px] flex items-center justify-center gap-2 active:scale-[0.97] text-xs font-semibold"
              >
                <Meh className="w-4 h-4 text-amber-500" />
                Neutral
              </Button>
              <Button
                type="button"
                variant={sentimentRating === 'challenging' ? 'default' : 'outline'}
                onClick={() => setSentimentRating('challenging')}
                className="min-h-[44px] flex items-center justify-center gap-2 active:scale-[0.97] text-xs font-semibold"
              >
                <Frown className="w-4 h-4 text-rose-500" />
                Challenging
              </Button>
            </div>
          </div>

          {/* Meeting Notes / Transcript Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Meeting Notes & Action Items</label>
              <span className="text-[11px] text-muted-foreground">Type &quot;Commitment:&quot; for automatic tasks</span>
            </div>
            <Textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={4}
              placeholder="Key discussion points, objections, and agreements..."
              className="text-xs bg-background leading-relaxed"
            />
          </div>

          {/* Extracted Intelligence Preview Box */}
          {extractedPreview && (
            <div className="rounded-lg border bg-muted/25 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" />
                  AI Intelligence Extracted
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Delta: {extractedPreview.crmSyncDraft.dealHealthDelta >= 0 ? '+' : ''}
                  {extractedPreview.crmSyncDraft.dealHealthDelta} Health
                </Badge>
              </div>

              {/* Signals & Objections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">Buying Signals:</span>
                  {extractedPreview.detectedBuyingSignals.length > 0 ? (
                    <ul className="space-y-1">
                      {extractedPreview.detectedBuyingSignals.map((sig, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{sig.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">None detected</p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">Objections Flagged:</span>
                  {extractedPreview.detectedObjections.length > 0 ? (
                    <ul className="space-y-1">
                      {extractedPreview.detectedObjections.map((obj, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">No open objections</p>
                  )}
                </div>
              </div>

              {/* Commitments & Follow-Up Tasks */}
              <div className="space-y-1.5 pt-1 border-t">
                <span className="text-xs font-semibold text-muted-foreground">
                  Follow-Up Tasks to Create ({extractedPreview.crmSyncDraft.tasksToCreate.length}):
                </span>
                <div className="space-y-1">
                  {extractedPreview.crmSyncDraft.tasksToCreate.map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-background border">
                      <span className="truncate max-w-sm font-medium">{task.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        Due {task.dueDate}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Stage Advance */}
              {extractedPreview.crmSyncDraft.suggestedStageName && (
                <div className="rounded bg-primary/10 border border-primary/20 p-2.5 flex items-center justify-between">
                  <span className="text-xs text-primary font-semibold">
                    Advance deal stage to &ldquo;{extractedPreview.crmSyncDraft.suggestedStageName}&rdquo;
                  </span>
                  <Badge className="bg-primary text-primary-foreground text-[10px]">1-Click Auto-Advance</Badge>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={handleSyncToCrm}
            className="min-h-[44px] active:scale-[0.97] font-bold"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            )}
            Approve & Sync to CRM (+20 pts)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
