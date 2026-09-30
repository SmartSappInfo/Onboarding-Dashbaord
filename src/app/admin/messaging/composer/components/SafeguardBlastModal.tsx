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
      <AlertDialogContent className="max-w-md rounded-2xl p-6 text-left">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-base sm:text-lg font-bold">
                {isScheduled ? 'Confirm Scheduled Broadcast' : 'Confirm Message Dispatch'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Please review your dispatch parameters before executing.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Pre-flight Summary Card */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3 my-2">
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
            <Badge variant="outline" className="text-[10px] font-bold capitalize py-0 px-2 h-5">
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

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
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

        <AlertDialogFooter className="gap-2 sm:gap-3">
          <AlertDialogCancel 
            disabled={isSubmitting} 
            className="rounded-xl h-11 text-xs font-semibold active:scale-[0.97]"
          >
            Review Changes
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting}
            className="rounded-xl h-11 text-xs font-bold bg-primary text-white hover:bg-primary/90 shadow-md active:scale-[0.97] transition-all px-5"
          >
            {isSubmitting ? 'Dispatching...' : isScheduled ? 'Confirm & Schedule' : `Confirm & Send to ${recipientCount}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
