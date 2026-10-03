'use client';

/**
 * @fileoverview 3-Option Creation Selector Modal for SmartSapp Meetings 2.0.
 *
 * ARCHITECTURE & DESIGN SYSTEM ALIGNMENT:
 * - Strictly conforms to theme.md §8 (Standardized Modal Architecture SSOT).
 * - Demarcated header with <CardInfoTooltip> and sr-only <DialogDescription>.
 * - Demarcated footer with tactile active:scale-[0.97] button.
 * - Mobile touch targets >= 44px with zero raw descriptions.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Video, Vote, ArrowRight, Sparkles } from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

interface NewMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSessionWizard?: () => void;
  onOpenPollWizard?: () => void;
}

export function NewMeetingModal({
  open,
  onOpenChange,
  onOpenSessionWizard,
  onOpenPollWizard,
}: NewMeetingModalProps) {
  const router = useRouter();

  const handleSelectAppointment = () => {
    onOpenChange(false);
    router.push('/admin/meetings/event-types/new');
  };

  const handleSelectSession = () => {
    onOpenChange(false);
    if (onOpenSessionWizard) {
      onOpenSessionWizard();
    } else {
      router.push('/admin/meetings/new');
    }
  };

  const handleSelectPoll = () => {
    onOpenChange(false);
    if (onOpenPollWizard) {
      onOpenPollWizard();
    } else {
      router.push('/admin/meetings/polls?create=true');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-lg p-0 overflow-hidden font-figtree">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              Create New
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              What would you like to schedule?
            </DialogTitle>
          </div>
          <CardInfoTooltip text="Choose the meeting format that best fits your workflow: 1:1 bookings, large group broadcasts, or consensus polls." />
          <DialogDescription className="sr-only">
            Select meeting format between 1:1 appointments, large group broadcasts, or consensus polls.
          </DialogDescription>
        </DialogHeader>

        {/* Options List */}
        <div className="px-6 py-5 space-y-3">
          {/* Option 1: 1:1 Appointment */}
          <button
            type="button"
            onClick={handleSelectAppointment}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  1:1 Appointment & Event Type
                </h4>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A recurring or single one-to-one booking page for sales calls, student advice, or consultations.
              </p>
            </div>
          </button>

          {/* Option 2: Session / Webinar */}
          <button
            type="button"
            onClick={handleSelectSession}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-border/80 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground group-hover:text-purple-600 transition-colors flex items-center gap-2">
                  Session & Webinar <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                </h4>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Large group broadcasts, parent orientations, or workshops with backstage and live moderation.
              </p>
            </div>
          </button>

          {/* Option 3: Scheduling Poll */}
          <button
            type="button"
            onClick={handleSelectPoll}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-border/80 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Vote className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground group-hover:text-amber-600 transition-colors">
                  Consensus Scheduling Poll
                </h4>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Propose multiple candidate times for group consensus voting and 1-click booking confirmation.
              </p>
            </div>
          </button>
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs px-4 font-semibold active:scale-[0.97]"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
