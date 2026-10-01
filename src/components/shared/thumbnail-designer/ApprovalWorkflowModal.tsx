'use client';

/**
 * ARCHITECTURE:
 * Approval Workflow & Editorial Sign-Off Modal (Phase 7 - Real-Time Collaboration)
 * 
 * Provides interactive modals for submitting visual designs for review,
 * approving with sign-off notes, or requesting structured design revisions.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import type { CreativeProject } from '@/lib/creative/creative-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentStatus: CreativeProject['status'];
  onSubmitForReview: (note: string) => Promise<void>;
  onApprove: (note: string) => Promise<void>;
  onRequestChanges: (notes: string) => Promise<void>;
}

export function ApprovalWorkflowModal({
  open,
  onOpenChange,
  projectId: _projectId,
  projectName,
  currentStatus,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
}: ApprovalWorkflowModalProps) {
  const [note, setNote] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'submit' | 'decision'>('submit');
  const [isPending, startTransition] = useTransition();

  const handleSubmitReview = () => {
    startTransition(async () => {
      await onSubmitForReview(note);
      onOpenChange(false);
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      await onApprove(note);
      onOpenChange(false);
    });
  };

  const handleRequestChanges = () => {
    if (!changeNotes.trim()) return;
    startTransition(async () => {
      await onRequestChanges(changeNotes);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Review & Approval
              <CardInfoTooltip text="Manage submission, creative sign-off, or revision requests for this thumbnail design." />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Manage submission, creative sign-off, or revision requests for this thumbnail design.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Current Status Pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
            <span className="text-muted-foreground font-semibold">{projectName}</span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider',
                currentStatus === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : currentStatus === 'in_review'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : currentStatus === 'changes_requested'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {currentStatus?.replace('_', ' ') || 'draft'}
            </span>
          </div>

          {currentStatus === 'draft' || currentStatus === 'changes_requested' ? (
            /* Submit for Review View */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Review Submission Note</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Notes for the reviewer regarding headline choices, layout, or campaign goals..."
                  className="bg-background border-border/80 text-xs text-foreground rounded-xl min-h-[90px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="h-10 text-xs font-medium rounded-xl active:scale-[0.97]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={isPending}
                  className="h-10 px-5 font-medium text-xs rounded-xl shadow-sm active:scale-[0.97]"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Submit for Review
                </Button>
              </div>
            </div>
          ) : (
            /* Reviewer Decision View */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('decision')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-[0.97]',
                    activeTab === 'decision'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-background border-border/80 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('submit')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-[0.97]',
                    activeTab === 'submit'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                      : 'bg-background border-border/80 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <AlertTriangle className="w-4 h-4 mx-auto mb-1" /> Request Changes
                </button>
              </div>

              {activeTab === 'decision' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Approval Sign-off Note (Optional)</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Looks fantastic, ready for publication."
                      className="h-10 bg-background border-border/80 text-xs text-foreground rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={handleApprove}
                    disabled={isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-10 rounded-xl active:scale-[0.97]"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                    Confirm Creative Approval
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Required Change Notes</Label>
                    <Textarea
                      value={changeNotes}
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="Specify what needs adjustments (e.g. Increase contrast on headline, shift avatar)..."
                      className="bg-background border-border/80 text-xs text-foreground rounded-xl min-h-[90px]"
                    />
                  </div>
                  <Button
                    onClick={handleRequestChanges}
                    disabled={isPending || !changeNotes.trim()}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs h-10 rounded-xl active:scale-[0.97]"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-1.5" />}
                    Send Revision Request
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
