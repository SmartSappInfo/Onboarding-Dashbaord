'use client';

/**
 * @fileoverview "Needs Attention" Actionable Panel (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Surfaces high-priority operational items requiring host intervention.
 * - Actionable buttons route directly to the appropriate sub-view.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Sparkles,
  ArrowRight,
  Flame,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface NeedsAttentionPanelProps {
  unconfirmedCount?: number;
  calendarIssue?: boolean;
  overdueTasksCount?: number;
  unresolvedHighIntentCount?: number;
}

export function NeedsAttentionPanel({
  unconfirmedCount = 0,
  calendarIssue = false,
  overdueTasksCount = 2,
  unresolvedHighIntentCount = 1,
}: NeedsAttentionPanelProps) {
  const totalIssues =
    (unconfirmedCount > 0 ? 1 : 0) +
    (calendarIssue ? 1 : 0) +
    (overdueTasksCount > 0 ? 1 : 0) +
    (unresolvedHighIntentCount > 0 ? 1 : 0);

  return (
    <Card className="rounded-3xl border border-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs">
      <CardHeader className="pb-3 border-b border-amber-200/30 flex flex-row items-center justify-between">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Needs Attention
          </CardTitle>
          <p className="text-xs text-muted-foreground">Actionable items requiring host intervention</p>
        </div>
        <Badge variant="outline" className="text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40">
          {totalIssues} {totalIssues === 1 ? 'Action' : 'Actions'}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-2.5">
        {/* Item 1: High Intent Prospect Needs Meeting */}
        {unresolvedHighIntentCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-amber-200/60 dark:border-amber-900/40 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  {unresolvedHighIntentCount} high-intent prospect has no next meeting
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  NovaTech expressed purchasing intent yesterday
                </p>
              </div>
            </div>
            <Link href="/admin/meetings/bookings">
              <Button size="sm" variant="outline" className="rounded-xl h-8 text-[11px] font-bold gap-1 shrink-0 active:scale-[0.97]">
                Schedule <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Item 2: Overdue CRM Follow-Up Tasks */}
        {overdueTasksCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">
                  {overdueTasksCount} meeting follow-up tasks are pending
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">
                  Send Enterprise Security Whitepaper
                </p>
              </div>
            </div>
            <Link href="/admin/tasks">
              <Button size="sm" variant="outline" className="rounded-xl h-8 text-[11px] font-bold gap-1 shrink-0 active:scale-[0.97]">
                View Tasks <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Item 3: Calendar Connection Sync */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-foreground truncate">
                External Calendar Sync Active
              </h5>
              <p className="text-[11px] text-muted-foreground truncate">
                Google Calendar synced 12 minutes ago
              </p>
            </div>
          </div>
          <Link href="/admin/meetings/calendars">
            <Button size="sm" variant="ghost" className="rounded-xl h-8 text-[11px] font-semibold text-muted-foreground hover:text-foreground shrink-0">
              Settings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
