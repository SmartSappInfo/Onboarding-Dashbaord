'use client';

/**
 * @fileOverview StandupHistoryView component (Phase 4B).
 *
 * Implements:
 * - Chronological history of past standup submissions.
 * - Commitment provenance and respectful carryover tracking.
 * - Displays accomplishments, commitments, blockers, and confidential manager notes (when accessible).
 * - Mobile-first layout with min-h-[44px] accessible affordances.
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  History,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Lock,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StandupSubmission } from '@/lib/types';

export interface StandupHistoryViewProps {
  workspaceId: string;
  standups: StandupSubmission[];
}

export function StandupHistoryView({
  workspaceId: _workspaceId,
  standups,
}: StandupHistoryViewProps) {
  const sortedStandups = React.useMemo(() => {
    return [...standups].sort((a, b) => b.date.localeCompare(a.date));
  }, [standups]);

  if (sortedStandups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card max-w-4xl mx-auto">
        <History className="h-10 w-10 text-muted-foreground/40 mb-2" />
        <h3 className="text-sm font-bold text-foreground">No standup history found</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Submitted daily updates will appear here in reverse chronological order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-figtree">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Standup History & Commitments</h2>
            <p className="text-xs text-muted-foreground">
              Review personal progress logs, past deliverables, and carryover provenance
            </p>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="space-y-4">
        {sortedStandups.map((submission) => (
          <div
            key={submission.id}
            className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4"
          >
            {/* Entry Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {format(new Date(submission.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold capitalize ${
                    submission.status === 'submitted'
                      ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {submission.status}
                </Badge>
                {submission.submittedAt && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(submission.submittedAt), 'p')}
                  </span>
                )}
              </div>
            </div>

            {/* Accomplished */}
            {submission.completedWork && submission.completedWork.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Accomplishments
                </p>
                <ul className="space-y-1 pl-5 list-disc text-sm text-foreground">
                  {submission.completedWork.map((item) => (
                    <li key={item.id} className="leading-snug">
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Commitments & Carryovers */}
            {submission.plannedWork && submission.plannedWork.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                  Planned Commitments
                </p>
                <ul className="space-y-1 pl-5 list-disc text-sm text-foreground">
                  {submission.plannedWork.map((item) => (
                    <li key={item.id} className="leading-snug">
                      {item.title}
                      {item.isCarryover && (
                        <Badge
                          variant="secondary"
                          className="ml-2 text-[10px] py-0 px-1.5 font-normal"
                        >
                          Continued
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blockers */}
            {submission.blockers && submission.blockers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Blockers
                </p>
                <div className="space-y-1.5">
                  {submission.blockers.map((blk) => (
                    <div
                      key={blk.id}
                      className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs text-foreground flex items-center justify-between gap-2"
                    >
                      <span className="font-semibold">{blk.summary}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold border-rose-600 text-rose-600"
                      >
                        {blk.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidential Note (rendered only if present) */}
            {submission.privateManagerNote && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Confidential Manager Note
                </p>
                <p className="text-xs text-foreground italic">{submission.privateManagerNote}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
