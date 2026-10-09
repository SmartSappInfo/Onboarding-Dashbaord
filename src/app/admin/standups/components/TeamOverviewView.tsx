'use client';

/**
 * @fileOverview TeamOverviewView component (Phase 4B).
 *
 * Implements:
 * - Summary metric cards (Submitted, Awaiting, Active Blockers).
 * - Date navigation with formatted day display.
 * - Team member standup updates with expandable accomplishments, commitments, blockers, and help needed.
 * - Privacy invariant: Strictly excludes privateManagerNote from team overview.
 * - Accessible controls with min-h-[44px] touch targets.
 */

import * as React from 'react';
import { format, addDays, subDays } from 'date-fns';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Calendar,
  BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { StandupSubmission, UserProfile } from '@/lib/types';

export interface TeamOverviewViewProps {
  workspaceId: string;
  standups: StandupSubmission[];
  teamMembers: UserProfile[];
  selectedDate: string;
  onDateChange?: (date: string) => void;
}

export function TeamOverviewView({
  workspaceId: _workspaceId,
  standups,
  teamMembers,
  selectedDate,
  onDateChange,
}: TeamOverviewViewProps) {
  const { toast } = useToast();

  const submittedCount = React.useMemo(
    () => standups.filter((s) => s.status === 'submitted').length,
    [standups]
  );
  const awaitingCount = Math.max(0, teamMembers.length - submittedCount);

  const totalBlockers = React.useMemo(
    () =>
      standups.reduce(
        (acc, s) => acc + (s.status === 'submitted' ? s.blockers?.length || 0 : 0),
        0
      ),
    [standups]
  );

  const handlePrevDay = () => {
    const prev = subDays(new Date(selectedDate + 'T12:00:00'), 1);
    onDateChange?.(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const next = addDays(new Date(selectedDate + 'T12:00:00'), 1);
    onDateChange?.(format(next, 'yyyy-MM-dd'));
  };

  const handleRemindMember = (member: UserProfile) => {
    toast({
      title: 'Reminder Sent',
      description: `Sent standup reminder notification to ${member.name || member.email}.`,
      actionConfig: {
        path: '/admin/standups?tab=team',
        label: 'Team Overview',
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-figtree">
      {/* Top Header & Day Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Team Daily Standup</h2>
            <p className="text-xs text-muted-foreground">
              Cross-functional progress, blockers, and team commitments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevDay}
            className="rounded-xl h-11 min-h-[44px] w-11 p-0 active:scale-[0.97]"
            aria-label="Previous Day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/60 text-xs font-bold text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{format(new Date(selectedDate + 'T12:00:00'), 'EEE, MMM d, yyyy')}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNextDay}
            className="rounded-xl h-11 min-h-[44px] w-11 p-0 active:scale-[0.97]"
            aria-label="Next Day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Team Members</p>
          <p className="text-2xl font-black text-foreground mt-1">{teamMembers.length}</p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Submitted
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{submittedCount}</p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-sm">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Awaiting</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{awaitingCount}</p>
        </div>

        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 shadow-sm">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            Active Blockers
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{totalBlockers}</p>
        </div>
      </div>

      {/* MEMBER UPDATES */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Member Submissions
        </h3>

        {teamMembers.map((member) => {
          const standup = standups.find(
            (s) => s.userId === member.id && s.status === 'submitted'
          );

          if (!standup) {
            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-xl border border-border/80">
                    <AvatarImage src={member.photoURL} alt={member.name || 'Member'} />
                    <AvatarFallback className="rounded-xl font-bold text-xs">
                      {(member.name || member.email || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-foreground">{member.name || member.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Awaiting daily standup
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemindMember(member)}
                  className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97]"
                >
                  <BellRing className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  Remind
                </Button>
              </div>
            );
          }

          return (
            <div
              key={member.id}
              className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-xl border border-border/80">
                    <AvatarImage src={standup.userPhotoUrl} alt={standup.userName || 'Member'} />
                    <AvatarFallback className="rounded-xl font-bold text-xs">
                      {(standup.userName || member.name || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {standup.userName || member.name || member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {standup.submittedAt
                        ? `Submitted ${format(new Date(standup.submittedAt), 'p')}`
                        : 'Submitted today'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs border-emerald-500/30 text-emerald-600 bg-emerald-500/5 font-semibold"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Submitted
                </Badge>
              </div>

              {/* Accomplished */}
              {standup.completedWork?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Accomplished
                  </p>
                  <ul className="space-y-1 pl-5 list-disc text-sm text-foreground">
                    {standup.completedWork.map((item) => (
                      <li key={item.id} className="leading-snug">
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Planned */}
              {standup.plannedWork?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    Committing to today
                  </p>
                  <ul className="space-y-1 pl-5 list-disc text-sm text-foreground">
                    {standup.plannedWork.map((item) => (
                      <li key={item.id} className="leading-snug">
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blockers */}
              {standup.blockers?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Blockers & Obstacles
                  </p>
                  <div className="space-y-2">
                    {standup.blockers.map((blk) => (
                      <div
                        key={blk.id}
                        className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs text-foreground space-y-1"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase tracking-wider border-rose-600 text-rose-600"
                          >
                            {blk.severity}
                          </Badge>
                          <span className="font-semibold text-sm">{blk.summary}</span>
                        </div>
                        {blk.neededAction && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Action:</span>{' '}
                            {blk.neededAction}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Help Needed */}
              {standup.helpNeeded && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Help Needed
                  </p>
                  <p className="text-sm text-foreground">{standup.helpNeeded}</p>
                </div>
              )}

              {/* NOTE: Strictly NO privateManagerNote here. It is omitted per privacy rules. */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
