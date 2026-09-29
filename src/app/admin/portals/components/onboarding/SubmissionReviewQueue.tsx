'use client';

/**
 * {{Org_name}} Experience Platform — Submission Review Queue
 *
 * Backoffice inbox for reviewing member task file submissions, grading deliverables,
 * providing actionable feedback, and distributing point bounties.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  listPendingSubmissionsAction,
  reviewTaskSubmissionAction,
} from '@/app/actions/engagement-actions';
import type { TaskSubmission } from '@/lib/types/engagement';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Calendar,
  Award,
  Loader2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface SubmissionReviewQueueProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  onReviewSuccess?: () => void;
}

export function SubmissionReviewQueue({
  portalId,
  portalSlug,
  organizationId: _organizationId,
  onReviewSuccess,
}: SubmissionReviewQueueProps) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = React.useState<TaskSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Review Dialog State
  const [activeSubmission, setActiveSubmission] = React.useState<TaskSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = React.useState<'approved' | 'rejected'>('approved');
  const [feedback, setFeedback] = React.useState('');
  const [pointsAwarded, setPointsAwarded] = React.useState(20);
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);

  const fetchSubmissions = React.useCallback(async () => {
    if (!portalId) return;
    setIsLoading(true);
    try {
      const res = await listPendingSubmissionsAction(portalId);
      if (res.success && res.data) {
        setSubmissions(res.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleOpenReview = React.useCallback((submission: TaskSubmission) => {
    setActiveSubmission(submission);
    setReviewStatus('approved');
    setFeedback('');
    setPointsAwarded(20);
  }, []);

  const handleExecuteReview = async () => {
    if (!activeSubmission) return;

    setIsSubmittingReview(true);
    try {
      const res = await reviewTaskSubmissionAction(
        {
          submissionId: activeSubmission.id,
          portalId,
          taskId: activeSubmission.taskId,
          userId: activeSubmission.userId,
          reviewStatus,
          feedback: feedback.trim() || undefined,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      toast({
        title: reviewStatus === 'approved' ? 'Submission Approved! 🎉' : 'Revision Requested ✍️',
        description:
          reviewStatus === 'approved'
            ? 'Approved submission and rewarded points to member.'
            : 'Sent feedback note to the member.',
      });

      setActiveSubmission(null);
      fetchSubmissions();
      onReviewSuccess?.();
    } catch (err: unknown) {
      toast({
        title: 'Review Action Failed',
        description: err instanceof Error ? err.message : 'Failed to save review.',
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderedSubmissions = React.useMemo(() => {
    return submissions.map(sub => (
      <Card
        key={sub.id}
        className="rounded-3xl border-2 border-border p-5 space-y-4 bg-card shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                Assignment Submission
              </div>
              <h4 className="font-extrabold text-sm text-foreground">
                Task ID: <span className="font-mono text-xs">{sub.taskId}</span>
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">
              Awaiting Review
            </Badge>
          </div>

          {/* Submitted file metadata */}
          {sub.submittedFileUrl && (
            <div className="p-3 rounded-2xl border border-border/80 bg-muted/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {sub.submittedFileName || 'Attached Deliverable'}
                  </p>
                  {sub.submittedFileSizeBytes && (
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(sub.submittedFileSizeBytes)}
                    </p>
                  )}
                </div>
              </div>

              <a
                href={sub.submittedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Download className="w-4 h-4" />
                View File
              </a>
            </div>
          )}

          {/* Notes from member */}
          {sub.notes && (
            <div className="p-3 rounded-xl bg-card border border-border/60 text-xs text-foreground/90 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                <MessageSquare className="w-3 h-3" /> Note from Member
              </div>
              <p className="italic leading-relaxed">{sub.notes}</p>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Submitted: {new Date(sub.submittedAt).toLocaleString()}
          </div>
        </div>

        {/* Review CTA */}
        <div className="pt-3 border-t border-border flex items-center justify-end">
          <Button
            onClick={() => handleOpenReview(sub)}
            className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] w-full sm:w-auto active:scale-[0.97] shadow-sm"
          >
            Grade & Review Submission
          </Button>
        </div>
      </Card>
    ));
  }, [submissions, handleOpenReview]);

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-extrabold text-base text-foreground">Pending Submissions</h3>
          <Badge variant="secondary" className="font-bold text-xs bg-primary/10 text-primary">
            {submissions.length} Awaiting Review
          </Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSubmissions}
          disabled={isLoading}
          className="rounded-xl font-bold text-xs gap-1.5 h-9 min-h-[44px] sm:min-h-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading pending student submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
          <Inbox className="w-12 h-12 mx-auto text-primary/40" />
          <h4 className="font-bold text-base text-foreground">Inbox Zero</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            All submitted member assignments and work files have been reviewed. Outstanding!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderedSubmissions}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={Boolean(activeSubmission)} onOpenChange={open => !open && setActiveSubmission(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4 text-amber-500" /> Instructor Evaluation
            </div>
            <DialogTitle className="text-xl font-black">Review Submission</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide feedback and decide whether to approve this submission and grant points.
            </DialogDescription>
          </DialogHeader>

          {activeSubmission && (
            <div className="space-y-4 pt-1">
              {/* Decision Selector */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={reviewStatus === 'approved' ? 'default' : 'outline'}
                  onClick={() => setReviewStatus('approved')}
                  className={`rounded-2xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97] ${
                    reviewStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </Button>

                <Button
                  type="button"
                  variant={reviewStatus === 'rejected' ? 'default' : 'outline'}
                  onClick={() => setReviewStatus('rejected')}
                  className={`rounded-2xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97] ${
                    reviewStatus === 'rejected' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Request Changes
                </Button>
              </div>

              {/* Points Bounty if Approved */}
              {reviewStatus === 'approved' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> Points Awarded
                  </Label>
                  <Input
                    type="number"
                    value={pointsAwarded}
                    onChange={e => setPointsAwarded(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-10 text-xs rounded-xl font-bold min-h-[44px]"
                    min={0}
                  />
                </div>
              )}

              {/* Feedback Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Feedback / Notes for Member
                </Label>
                <Textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder={
                    reviewStatus === 'approved'
                      ? 'Great execution on the audit workbook!'
                      : 'Please review column C and re-submit your sheet.'
                  }
                  rows={3}
                  className="text-xs rounded-xl resize-none"
                />
              </div>

              {/* Deliverable Link */}
              {activeSubmission.submittedFileUrl && (
                <div className="pt-1">
                  <a
                    href={activeSubmission.submittedFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Re-check file deliverable
                  </a>
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmittingReview}
                  onClick={() => setActiveSubmission(null)}
                  className="rounded-xl font-bold text-xs w-full sm:w-auto min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isSubmittingReview}
                  onClick={handleExecuteReview}
                  className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 w-full sm:w-auto min-h-[44px] active:scale-[0.97] gap-1.5 shadow-sm"
                >
                  {isSubmittingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Review...
                    </>
                  ) : reviewStatus === 'approved' ? (
                    'Confirm Approval'
                  ) : (
                    'Send Revision Request'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
