'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Safeguard Blast Confirmation Modal
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS (Rule 10):
 * 1. Prevents accidental large volume dispatches through an explicit pre-flight review modal.
 * 2. Strict Zero-Any Invariant: All props are strictly typed.
 * 3. Mobile-first ergonomics: Touch targets >= 44px, tactile Emil Kowalski press states (active:scale-[0.97]).
 */

import * as React from 'react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { Send, Users, ShieldCheck, Clock, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface SafeguardBlastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipientCount: number;
  channel: 'email' | 'sms' | 'whatsapp';
  senderProfileLabel?: string;
  isScheduled: boolean;
  scheduledAt?: Date;
  isSubmitting?: boolean;
}

export function SafeguardBlastModal({
  open,
  onOpenChange,
  onConfirm,
  recipientCount,
  channel,
  senderProfileLabel = 'Default Profile',
  isScheduled,
  scheduledAt,
  isSubmitting = false,
}: SafeguardBlastModalProps) {
  const ChannelIcon = channel === 'email' ? Mail : channel === 'whatsapp' ? MessageSquare : Smartphone;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        {/* Demarcated Header (theme.md Section 8.2) */}
        <AlertDialogHeader className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Send className="h-4 w-4" />
            </div>
            <AlertDialogTitle className="text-sm sm:text-base font-bold text-foreground truncate">
              {isScheduled ? 'Confirm Scheduled Broadcast' : 'Confirm Message Dispatch'}
            </AlertDialogTitle>
            <CardInfoTooltip text="Review your audience volume, selected channel, and dispatch timing parameters before executing this operation." />
          </div>
          <AlertDialogDescription className="sr-only">
            Please review your dispatch parameters before executing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Modal Body Container */}
        <div className="p-6 space-y-4">
          {/* Pre-flight Summary Card */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Users className="h-3.5 w-3.5" /> Total Volume
              </span>
              <span className="font-bold text-foreground tabular-nums">
                {recipientCount} recipients
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <ChannelIcon className="h-3.5 w-3.5" /> Channel
              </span>
              <Badge variant="outline" className="text-[10px] font-bold capitalize py-0 px-2 h-5 border-border/70">
                {channel}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Sender
              </span>
              <span className="font-semibold text-foreground truncate max-w-[200px]" title={senderProfileLabel}>
                {senderProfileLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" /> Delivery Mode
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {isScheduled && scheduledAt
                  ? `Scheduled for ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Immediate Dispatch'}
              </span>
            </div>
          </div>
        </div>

        {/* Demarcated Footer Bar (theme.md Section 8.5) */}
        <AlertDialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <AlertDialogCancel 
            disabled={isSubmitting} 
            className="rounded-xl min-h-[44px] text-xs font-semibold active:scale-[0.97] border-border/70 mt-0"
          >
            Review Changes
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-[0.97] transition-all px-5 mt-0"
          >
            {isSubmitting ? 'Dispatching...' : isScheduled ? 'Confirm & Schedule' : `Confirm & Send to ${recipientCount}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

