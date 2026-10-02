'use client';

/**
 * @fileOverview Dead-Letter Queue (DLQ) Operator Console Drawer (Phase 2 Milestone 3 - Task 5)
 *
 * Implements theme.md §8 Modal Architecture, Rule 4 (Strict Typing),
 * Rule 24 (Circuit Breakers), Rule 25 (DLQ Ops & Replay), Rule 61 (Operator Console),
 * and Rule 10 (Inline Architectural Documentation).
 *
 * Invariants:
 *   1. Strict Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
 *   2. Demarcated Header: `<DialogHeader demarcated>` with `<CardInfoTooltip text="..." />`.
 *   3. Zero Raw Descriptions: `<DialogDescription className="sr-only">`.
 *   4. Mobile & Touch Targets: `min-h-[44px]` with Emil Kowalski active state (`active:scale-[0.97]`).
 *   5. Zero `any` or `any[]` typing.
 *
 * @testability Covered in `src/platform/__tests__/ui/dlq-drawer.test.tsx`.
 */

import * as React from 'react';
import type { DeadLetterRecord } from '@/platform/events/storage/dead-letter-storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  listDeadLetterEventsAction,
  replayDeadLetterEventAction,
  discardDeadLetterEventAction,
} from '@/app/actions/activity-actions';
import { toast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export interface DeadLetterQueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeadLetterQueueDrawer({
  open,
  onOpenChange,
}: DeadLetterQueueDrawerProps) {
  const [records, setRecords] = React.useState<DeadLetterRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [expandedStackId, setExpandedStackId] = React.useState<string | null>(null);

  const fetchRecords = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDeadLetterEventsAction();
      if (res.success && res.data) {
        setRecords(res.data);
      } else {
        toast({
          title: 'Failed to load DLQ',
          description: res.error || 'Could not fetch dead-letter records.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected network error occurred while fetching the dead-letter queue.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void fetchRecords();
    }
  }, [open, fetchRecords]);

  const handleReplay = async (eventId: string) => {
    setActingId(eventId);
    try {
      const res = await replayDeadLetterEventAction({ eventId });
      if (res.success) {
        toast({
          title: 'Event Replayed',
          description: `Event ${eventId} has been re-dispatched into the system bus.`,
        });
        setRecords((prev) => prev.filter((r) => r.eventId !== eventId));
      } else {
        toast({
          title: 'Replay Failed',
          description: res.error || 'Failed to replay dead-letter event.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to trigger event replay action.',
        variant: 'destructive',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleDiscard = async (eventId: string) => {
    setActingId(eventId);
    try {
      const res = await discardDeadLetterEventAction({
        eventId,
        reason: 'Operator manual discard',
      });
      if (res.success) {
        toast({
          title: 'Event Discarded',
          description: `Event ${eventId} has been discarded from the quarantine queue.`,
        });
        setRecords((prev) => prev.filter((r) => r.eventId !== eventId));
      } else {
        toast({
          title: 'Discard Failed',
          description: res.error || 'Failed to discard dead-letter event.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to trigger event discard action.',
        variant: 'destructive',
      });
    } finally {
      setActingId(null);
    }
  };

  const toggleStack = (eventId: string) => {
    setExpandedStackId((prev) => (prev === eventId ? null : eventId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="dead-letter-queue-drawer"
        className="sm:max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header (§8.2 theme.md) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <span>Dead-Letter Queue Operator Console</span>
            </DialogTitle>
            {/* Single-Circle Info Tooltip (§8.3 theme.md) */}
            <CardInfoTooltip text="Quarantined failed events, poison pills, and unrecoverable dispatch errors requiring manual operator intervention or replay." />
          </div>
          {/* Zero raw description: sr-only for WCAG AA (§8.2 theme.md) */}
          <DialogDescription className="sr-only">
            Dead-letter queue inspection and event replay operator console
          </DialogDescription>
        </DialogHeader>

        {/* Action / Status Bar */}
        <div className="px-6 py-2.5 border-b border-border/60 bg-muted/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {records.length} Quarantined
            </Badge>
            <span className="text-muted-foreground hidden sm:inline">
              Events exceeding maximum retry attempts are quarantined here.
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchRecords}
            disabled={loading}
            className="h-8 px-2.5 text-xs rounded-lg active:scale-95 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Scrollable List Body */}
        <div className="overflow-y-auto p-6 space-y-4 text-sm divide-y divide-border/40">
          {loading && records.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p>Scanning Dead-Letter Queue...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <div className="p-3 bg-emerald-500/10 rounded-full w-fit mx-auto text-emerald-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="font-medium text-foreground">Dead-Letter Queue is Clean</p>
              <p className="text-xs">No poison pills or quarantined event failures detected.</p>
            </div>
          ) : (
            records.map((rec) => {
              const isExpanded = expandedStackId === rec.eventId;
              const isActing = actingId === rec.eventId;

              return (
                <div key={rec.eventId} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Event Type & Timing */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono text-xs font-semibold">
                          {rec.event.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs border-rose-300 text-rose-600 bg-rose-50/50 dark:bg-rose-950/20"
                        >
                          Attempts: {rec.attempts}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {new Date(rec.quarantinedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Event ID: {rec.eventId}
                      </p>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActing}
                        onClick={() => handleReplay(rec.eventId)}
                        className="rounded-xl px-3 min-h-[44px] sm:min-h-[36px] active:scale-[0.97] transition-transform text-xs flex items-center gap-1.5"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${isActing ? 'animate-spin' : ''}`} />
                        <span>Retry Dispatch</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isActing}
                        onClick={() => handleDiscard(rec.eventId)}
                        className="rounded-xl px-3 min-h-[44px] sm:min-h-[36px] active:scale-[0.97] transition-transform text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Discard</span>
                      </Button>
                    </div>
                  </div>

                  {/* Error Reason Display */}
                  <div className="p-3 rounded-xl border border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/15 dark:border-rose-900/60 text-xs space-y-1">
                    <p className="font-semibold text-rose-800 dark:text-rose-300">Failure Reason:</p>
                    <p className="font-mono text-rose-700 dark:text-rose-400 break-words">
                      {rec.lastError}
                    </p>
                  </div>

                  {/* Expandable Stack Trace */}
                  {rec.errorStack && (
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStack(rec.eventId)}
                        className="h-7 px-2 text-xs text-muted-foreground flex items-center gap-1 rounded-lg"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span>{isExpanded ? 'Hide Stack Trace' : 'View Stack Trace'}</span>
                      </Button>

                      {isExpanded && (
                        <pre className="mt-2 p-3 rounded-xl border border-border/80 bg-muted/40 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed text-foreground/80">
                          {rec.errorStack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Demarcated Footer Bar (§8.5 theme.md) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 active:scale-[0.97] transition-transform min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
