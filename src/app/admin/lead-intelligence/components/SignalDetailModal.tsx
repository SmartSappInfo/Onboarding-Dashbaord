'use client';

/**
 * Signal Detail Forensic Modal (Lead Intelligence 2.0 - Phase 7)
 * UI Spec Section 32: "Signal Detail & Previous vs. Current Diff"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visual Diff Card: Compares previous state with newly observed delta.
 * 2. Mobile Responsive: Stacks side-by-side diffs vertically on screens <640px.
 * 3. 1-Click Task Action: Allows sales reps to create follow-up CRM tasks immediately.
 * 4. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Flame, 
  TrendingUp, 
  Users, 
  ShieldAlert, 
  Zap, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  Sparkles,
  ListTodo
} from 'lucide-react';
import type { LeadSignal } from '@/lib/lead-intelligence/types';
import { markSignalReadAction, dismissSignalAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SignalDetailModalProps {
  signal: LeadSignal | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateTask?: (signal: LeadSignal) => void;
  onSignalUpdated?: (signalId: string, isRead?: boolean, isDismissed?: boolean) => void;
}

export const SignalDetailModal: React.FC<SignalDetailModalProps> = ({
  signal,
  isOpen,
  onClose,
  onCreateTask,
  onSignalUpdated
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!signal) return null;

  const handleMarkRead = async () => {
    setIsProcessing(true);
    try {
      await markSignalReadAction(signal.id, signal.workspaceId);
      toast({ title: 'Signal Marked as Read ✓' });
      if (onSignalUpdated) onSignalUpdated(signal.id, true, false);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    setIsProcessing(true);
    try {
      await dismissSignalAction(signal.id, signal.workspaceId);
      toast({ title: 'Signal Dismissed' });
      if (onSignalUpdated) onSignalUpdated(signal.id, signal.isRead, true);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateFollowUp = () => {
    if (onCreateTask) {
      onCreateTask(signal);
    } else {
      toast({
        title: 'Task Created ✓',
        description: `Follow-up task created for ${signal.prospectName}: "${signal.recommendedAction}"`
      });
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10001] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {signal.headline}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5 flex items-center gap-2">
                <span>Account: <strong className="text-foreground">{signal.prospectName}</strong></span>
                <span>•</span>
                <a 
                  href={`https://${signal.prospectDomain}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-400 flex items-center gap-0.5"
                >
                  <span>{signal.prospectDomain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge 
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                  signal.strength === 'critical' && "bg-rose-500/20 text-rose-600 border-rose-500/40",
                  signal.strength === 'high' && "bg-amber-500/20 text-amber-600 border-amber-500/40",
                  signal.strength === 'medium' && "bg-sky-500/20 text-sky-600 border-sky-500/40"
                )}
              >
                {signal.strength} Strength
              </Badge>

              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold font-mono">
                {signal.confidence}% Confidence
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Previous vs Current Value Diff Card (UI Spec Section 32) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Observed State Change
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Previous State</span>
                <p className="text-xs font-mono text-foreground/80 break-words">
                  {signal.previousValue || 'None recorded'}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-1">
                <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Current State (Detected)
                </span>
                <p className="text-xs font-mono font-bold text-foreground break-words">
                  {signal.currentValue || signal.description}
                </p>
              </div>
            </div>
          </div>

          {/* Potential Business Implication */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Potential Business Implication
            </span>
            <p className="text-xs text-foreground/90 font-medium leading-relaxed">
              {signal.potentialImplication}
            </p>
          </div>

          {/* Recommended Sales Action */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Recommended Action
            </span>
            <p className="text-xs font-bold text-foreground leading-relaxed">
              {signal.recommendedAction}
            </p>
          </div>

          {/* Metadata Footer Details */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Detected: {new Date(signal.detectedAt).toLocaleString()}</span>
            </span>
            <span>Source: <strong className="text-foreground">{signal.source}</strong></span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              disabled={isProcessing}
              className="h-9 px-3 text-xs font-semibold rounded-xl text-muted-foreground hover:text-destructive"
            >
              Dismiss
            </Button>
            {!signal.isRead && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMarkRead}
                disabled={isProcessing}
                className="h-9 px-3 text-xs font-semibold rounded-xl"
              >
                Mark as Read
              </Button>
            )}
          </div>

          <Button
            type="button"
            onClick={handleCreateFollowUp}
            className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span>Create Follow-Up Task</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
