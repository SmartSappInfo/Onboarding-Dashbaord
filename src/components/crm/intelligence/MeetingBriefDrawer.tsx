'use client';

/**
 * @fileOverview Pre-Meeting Intelligence Brief Modal Component (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 13/30 (Untrusted Reference Data XML containerization), and `theme.md` §8 (Standardized Modal Architecture).
 *
 * Displays:
 * - Attendee dossiers (role, past interaction count, sentiment)
 * - Open commitments checklist with overdue badges
 * - Anticipated objections & suggested discovery questions
 * - Recommended negotiation & presentation strategy
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Calendar,
  Users,
  CheckSquare,
  HelpCircle,
  AlertTriangle,
  Compass,
  FileText,
  Clock,
  Mail,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MeetingBrief } from '@/platform/agents/crm/intelligence/crm-intelligence-types';

export interface MeetingBriefDrawerProps {
  brief: MeetingBrief | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function MeetingBriefDrawer({
  brief,
  isOpen,
  onOpenChange,
  className,
}: MeetingBriefDrawerProps) {
  if (!brief) return null;

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <Smile className="h-3.5 w-3.5 text-emerald-500" />;
      case 'negative':
        return <Frown className="h-3.5 w-3.5 text-rose-500" />;
      case 'neutral':
      default:
        return <Meh className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden',
          className
        )}
      >
        <DialogHeader
          demarcated
          className="px-6 py-4 min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between space-y-0"
        >
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Pre-Meeting Intelligence Brief
            </DialogTitle>
            <CardInfoTooltip text="Automated attendee dossiers, open commitments, and tactical strategy for upcoming interaction." />
          </div>
          <DialogDescription className="sr-only">
            Detailed pre-meeting briefing dossier and preparation playbook
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Meeting Title & Meta */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/70 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-foreground">{brief.title}</h3>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                <Clock className="h-3 w-3" />
                {new Date(brief.startTime).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{brief.relationshipSummary}</p>
          </div>

          {/* Attendee Dossiers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>Attendee Dossiers ({brief.attendees.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brief.attendees.map((att, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border/70 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{att.name}</span>
                    <div className="flex items-center gap-1">
                      {getSentimentIcon(att.lastSentiment)}
                      <span className="text-[10px] text-muted-foreground capitalize">{att.lastSentiment || 'Neutral'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="font-medium text-foreground/80">{att.role}</div>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>{att.email}</span>
                    </div>
                    <div>{att.pastInteractionsCount} past interactions logged</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Commitments Checklist */}
          {brief.openCommitments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                <span>Open Commitments Due ({brief.openCommitments.length})</span>
              </div>
              <div className="space-y-2">
                {brief.openCommitments.map((com) => (
                  <div
                    key={com.id}
                    className="p-3 rounded-xl border border-border/70 bg-card flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground">{com.title}</span>
                      {com.dueDate && (
                        <p className="text-[11px] text-muted-foreground">
                          Due: {new Date(com.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {com.isOverdue && (
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px] font-bold shrink-0">
                        OVERDUE
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Likely Objectives & Potential Objections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Likely Objectives</span>
              </div>
              <ul className="space-y-1.5">
                {brief.likelyObjectives.map((obj, idx) => (
                  <li key={idx} className="text-xs text-foreground/90 flex items-start gap-1.5">
                    <span className="text-primary">•</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Potential Objections</span>
              </div>
              <ul className="space-y-1.5">
                {brief.potentialObjections.map((obj, idx) => (
                  <li key={idx} className="text-xs text-foreground/90 flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Suggested Questions */}
          {brief.suggestedQuestions.length > 0 && (
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                <span>Suggested Discovery Questions</span>
              </div>
              <div className="space-y-2">
                {brief.suggestedQuestions.map((q, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-muted/15 border border-border/60 text-xs font-medium text-foreground">
                    "{q}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Strategy */}
          {brief.recommendedStrategy && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Compass className="h-3.5 w-3.5" />
                <span>Recommended Meeting Strategy</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                {brief.recommendedStrategy}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="rounded-xl px-4 min-h-[44px] active:scale-[0.97]"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
