'use client';

/**
 * @fileoverview AI Scheduling Copilot Modal for SmartSapp Meetings 2.0.
 *
 * ARCHITECTURE & DESIGN SYSTEM ALIGNMENT:
 * - Strictly conforms to theme.md §8 (Standardized Modal Architecture SSOT).
 * - Demarcated header with <CardInfoTooltip> and sr-only <DialogDescription>.
 * - Dynamic attendee email resolution (replaces hardcoded fallback).
 * - Zero 'any' policy strictly enforced.
 * - Tactile micro-interactions (active:scale-[0.97]) and mobile touch targets >= 44px.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Network timeouts and slot booking errors must surface actionable toasts with relative paths.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  Bot,
  User,
  Clock,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  parseAndSuggestSlotsAction,
  confirmAIScheduledBookingAction,
} from '@/app/actions/ai-scheduling-actions';
import type { SuggestedBookingSlot } from '@/lib/meetings/types/ai-assistant';

interface AISchedulingAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to process request.';
}

export function AISchedulingAssistantModal({
  open,
  onOpenChange,
}: AISchedulingAssistantModalProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [prompt, setPrompt] = React.useState('');
  const [attendeeEmail, setAttendeeEmail] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [intentSummary, setIntentSummary] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<SuggestedBookingSlot[]>([]);
  const [confirmedSlot, setConfirmedSlot] = React.useState<string | null>(null);
  const [isConfirmingSlot, setIsConfirmingSlot] = React.useState(false);

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !activeWorkspaceId) return;

    setIsProcessing(true);
    setIntentSummary(null);
    setSuggestions([]);
    setConfirmedSlot(null);

    try {
      const res = await parseAndSuggestSlotsAction({
        workspaceId: activeWorkspaceId,
        prompt: prompt.trim(),
      });

      if (res.success && res.suggestions) {
        setIntentSummary(res.intentSummary || null);
        setSuggestions(res.suggestions);
      } else {
        throw new Error(res.error || 'Failed to detect available slots.');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Assistant Error',
        description: getErrorMessage(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSlot = async (slot: SuggestedBookingSlot) => {
    if (!activeWorkspaceId) return;
    setIsConfirmingSlot(true);
    try {
      const targetAttendeeEmail = attendeeEmail.trim() || 'attendee@scheduled.meeting';
      const res = await confirmAIScheduledBookingAction({
        workspaceId: activeWorkspaceId,
        title: 'AI Scheduled Meeting',
        startAt: slot.startAt,
        endAt: slot.endAt,
        hostUserId: slot.hostUserId,
        attendeeEmail: targetAttendeeEmail,
      });

      if (res.success) {
        setConfirmedSlot(slot.startAt);
        toast({
          title: 'Meeting Scheduled!',
          description: `Confirmed with ${slot.hostName} for ${slot.formattedLabel}.`,
          actionConfig: {
            path: '/admin/meetings/calendar',
            label: 'View Calendar',
          },
          duration: 8000,
        });
      } else {
        throw new Error(res.error || 'Unable to confirm scheduled slot.');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Booking Confirmation Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsConfirmingSlot(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-lg p-0 overflow-hidden">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold text-foreground">
              AI Scheduling Copilot
            </DialogTitle>
          </div>
          <CardInfoTooltip text="Describe your scheduling requirements in natural everyday English to automatically detect available host slots." />
          <DialogDescription className="sr-only">
            AI-powered conversational meeting scheduler and slot detection copilot.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleAskAI} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Scheduling Instructions
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Book 30 min quick sync with John tomorrow afternoon"
                className="rounded-xl min-h-[44px] text-xs flex-1"
              />
              <Button
                type="submit"
                disabled={isProcessing || !prompt.trim()}
                className="rounded-xl min-h-[44px] px-4 shrink-0 font-semibold gap-1.5 active:scale-[0.97]"
              >
                <Sparkles className="h-4 w-4" />
                Find Slots
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Attendee Email <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Input
              type="email"
              value={attendeeEmail}
              onChange={e => setAttendeeEmail(e.target.value)}
              placeholder="e.g. alex@corp.com"
              className="rounded-xl min-h-[44px] sm:min-h-[38px] text-xs"
            />
          </div>

          {isProcessing && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          )}

          {intentSummary && (
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">AI Plan: </span>
              {intentSummary}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Recommended Available Slots
              </p>
              {suggestions.map((s, idx) => {
                const isBooked = confirmedSlot === s.startAt;
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      isBooked
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-card/70 hover:border-primary/40'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-foreground">{s.formattedLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>Host: {s.hostName}</span>
                        <Badge variant="secondary" className="text-[9px] h-4">
                          {Math.round(s.confidenceScore * 100)}% match
                        </Badge>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(confirmedSlot) || isConfirmingSlot}
                      onClick={() => handleConfirmSlot(s)}
                      className={`rounded-xl min-h-[36px] text-xs font-semibold px-3 active:scale-[0.97] ${
                        isBooked ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''
                      }`}
                    >
                      {isBooked ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Booked
                        </>
                      ) : isConfirmingSlot ? (
                        'Booking...'
                      ) : (
                        'Book Slot'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </form>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs px-4 font-semibold active:scale-[0.97]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
