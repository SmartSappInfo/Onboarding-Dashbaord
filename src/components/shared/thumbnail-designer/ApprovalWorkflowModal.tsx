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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Editorial Review & Approval
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current Status Pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold">{projectName}</span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider',
                currentStatus === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : currentStatus === 'in_review'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : currentStatus === 'changes_requested'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              )}
            >
              {currentStatus?.replace('_', ' ') || 'draft'}
            </span>
          </div>

          {currentStatus === 'draft' || currentStatus === 'changes_requested' ? (
            /* Submit for Review View */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Review Submission Note</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Notes for the reviewer regarding headline choices, layout, or campaign goals..."
                  className="bg-slate-900 border-slate-800 text-xs text-slate-200 rounded-xl min-h-[90px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={isPending}
                  className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-[0.97]"
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
                  onClick={() => setActiveTab('decision')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all',
                    activeTab === 'decision'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  )}
                >
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1" /> Approve
                </button>
                <button
                  onClick={() => setActiveTab('submit')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all',
                    activeTab === 'submit'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  )}
                >
                  <AlertTriangle className="w-4 h-4 mx-auto mb-1" /> Request Changes
                </button>
              </div>

              {activeTab === 'decision' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Approval Sign-off Note (Optional)</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Looks fantastic, ready for publication."
                      className="h-10 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={handleApprove}
                    disabled={isPending}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs h-10 rounded-xl active:scale-[0.97]"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                    Confirm Creative Approval
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Required Change Notes</Label>
                    <Textarea
                      value={changeNotes}
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="Specify what needs adjustments (e.g. Increase contrast on headline, shift avatar)..."
                      className="bg-slate-900 border-slate-800 text-xs text-slate-200 rounded-xl min-h-[90px]"
                    />
                  </div>
                  <Button
                    onClick={handleRequestChanges}
                    disabled={isPending || !changeNotes.trim()}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs h-10 rounded-xl active:scale-[0.97]"
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
