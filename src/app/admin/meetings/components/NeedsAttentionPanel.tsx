'use client';

/**
 * @fileoverview "Needs Attention" Actionable Panel (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Surfaces high-priority operational items requiring host intervention.
 * - Actionable buttons route directly to the appropriate sub-view.
 * - Zero dummy data: all indicators derived strictly from real schedule state.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Link2Off,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { UnifiedMeetingItem } from '@/lib/meetings/types/unified-meeting';

export interface NeedsAttentionPanelProps {
  unconfirmedBookings?: UnifiedMeetingItem[];
  sessionsMissingLink?: UnifiedMeetingItem[];
  isCalendarConnected?: boolean;
  connectedCount?: number;
  isLoading?: boolean;
}

export function NeedsAttentionPanel({
  unconfirmedBookings = [],
  sessionsMissingLink = [],
  isCalendarConnected = true,
  connectedCount = 0,
  isLoading = false,
}: NeedsAttentionPanelProps) {
  const pendingCount = unconfirmedBookings.length;
  const missingLinkCount = sessionsMissingLink.length;
  const calendarDisconnected = !isCalendarConnected;

  const totalIssues =
    (pendingCount > 0 ? 1 : 0) +
    (missingLinkCount > 0 ? 1 : 0) +
    (calendarDisconnected ? 1 : 0);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  // All clear state: zero pending issues
  if (totalIssues === 0) {
    return (
      <Card className="rounded-3xl border border-emerald-500/20 bg-emerald-50/15 dark:bg-emerald-950/10 shadow-xs">
        <CardHeader className="pb-3 border-b border-emerald-500/15 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Needs Attention
            </CardTitle>
            <CardInfoTooltip text="Actionable operational items requiring host intervention." />
          </div>
          <Badge variant="outline" className="text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
            All Clear
          </Badge>
        </CardHeader>

        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-card/80 border border-emerald-500/20 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  All Systems Operational
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  {connectedCount > 0
                    ? `${connectedCount} calendar connected • All sessions confirmed`
                    : 'All appointments and group sessions are on schedule'}
                </p>
              </div>
            </div>
            <Link href="/admin/meetings/calendar">
              <Button size="sm" variant="ghost" className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-semibold text-muted-foreground hover:text-foreground shrink-0 active:scale-[0.97]">
                View Hub
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs">
      <CardHeader className="pb-3 border-b border-amber-200/30 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Needs Attention
          </CardTitle>
          <CardInfoTooltip text="Actionable operational items requiring host intervention." />
        </div>
        <Badge variant="outline" className="text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40">
          {totalIssues} {totalIssues === 1 ? 'Action' : 'Actions'}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-2.5">
        {/* Item 1: Pending Unconfirmed Bookings */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-amber-200/60 dark:border-amber-900/40 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  {pendingCount} appointment{pendingCount === 1 ? '' : 's'} awaiting confirmation
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  {unconfirmedBookings[0].contactName ? `${unconfirmedBookings[0].contactName} • ` : ''}
                  {unconfirmedBookings[0].title}
                </p>
              </div>
            </div>
            <Link href="/admin/meetings/bookings">
              <Button size="sm" variant="outline" className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-bold gap-1 shrink-0 active:scale-[0.97]">
                Review <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Item 2: Sessions Missing Video Conferencing Link */}
        {missingLinkCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-rose-200/60 dark:border-rose-900/40 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Link2Off className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  {missingLinkCount} session{missingLinkCount === 1 ? '' : 's'} missing conferencing link
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  {sessionsMissingLink[0].title}
                </p>
              </div>
            </div>
            <Link
              href={
                sessionsMissingLink[0].sourceType === 'meeting'
                  ? `/admin/meetings/${sessionsMissingLink[0].id}/edit`
                  : '/admin/meetings/bookings'
              }
            >
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-bold gap-1 shrink-0 active:scale-[0.97] border-rose-200/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Add Link <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Item 3: Calendar Connection Issue */}
        {calendarDisconnected && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-amber-200/60 dark:border-amber-900/40 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  No External Calendar Connected
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  Connect Google or Outlook to prevent scheduling conflicts
                </p>
              </div>
            </div>
            <Link href="/admin/meetings/calendars">
              <Button size="sm" variant="outline" className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-bold gap-1 shrink-0 active:scale-[0.97]">
                Connect <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
