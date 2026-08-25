'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  Bot,
  Send,
  CalendarCheck,
  User,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  parseAndSuggestSlotsAction,
  confirmAIScheduledBookingAction,
} from '@/app/actions/ai-scheduling-actions';
import type { SuggestedBookingSlot } from '@/lib/meetings/types/ai-assistant';

interface AISchedulingAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISchedulingAssistantModal({
  open,
  onOpenChange,
}: AISchedulingAssistantModalProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [prompt, setPrompt] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [intentSummary, setIntentSummary] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<SuggestedBookingSlot[]>([]);
  const [confirmedSlot, setConfirmedSlot] = React.useState<string | null>(null);

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
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Assistant Error',
        description: 'Failed to parse scheduling prompt.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSlot = async (slot: SuggestedBookingSlot) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await confirmAIScheduledBookingAction({
        workspaceId: activeWorkspaceId,
        title: 'AI Scheduled Meeting',
        startAt: slot.startAt,
        endAt: slot.endAt,
        hostUserId: slot.hostUserId,
        attendeeEmail: 'invitee@example.com',
      });

      if (res.success) {
        setConfirmedSlot(slot.startAt);
        toast({
          title: 'Meeting Scheduled!',
          description: `Booked for ${slot.formattedLabel}`,
        });
      }
    } catch (err) {
      console.warn('[confirm ai slot]', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Scheduling Copilot
          </DialogTitle>
          <DialogDescription className="text-xs">
            Describe what you need in plain English (e.g. &quot;Schedule a 45-min demo with alex@corp.com next Tuesday afternoon&quot;).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAskAI} className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Book 30 min quick sync with John tomorrow afternoon"
              className="rounded-xl min-h-[44px] text-xs"
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

          {isProcessing && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          )}

          {intentSummary && (
            <div className="p-3 rounded-2xl bg-muted/30 border text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">AI Plan: </span>
              {intentSummary}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Recommended Available Slots
              </p>
              {suggestions.map((s, idx) => {
                const isBooked = confirmedSlot === s.startAt;
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      isBooked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card/70 hover:border-primary/40'
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
                      disabled={Boolean(confirmedSlot)}
                      onClick={() => handleConfirmSlot(s)}
                      className={`rounded-xl h-8 text-xs font-semibold px-3 active:scale-[0.97] ${
                        isBooked ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''
                      }`}
                    >
                      {isBooked ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Booked
                        </>
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
      </DialogContent>
    </Dialog>
  );
}
