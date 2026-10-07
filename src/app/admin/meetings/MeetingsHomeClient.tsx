'use client';

/**
 * @fileoverview Meetings Home Executive Dashboard (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Serves as the primary operational workspace landing page.
 * - Powered by SSOT useWorkspaceSchedule hook unifying bookings and group sessions.
 * - Zero dummy data: every KPI, card, and stream binds to real schedule state.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { MyDayTimeline } from './components/MyDayTimeline';
import { NeedsAttentionPanel } from './components/NeedsAttentionPanel';
import { UpcomingSessionsCard } from './components/UpcomingSessionsCard';
import { BookingDetailDrawer } from './bookings/components/BookingDetailDrawer';
import { useWorkspaceSchedule } from '@/lib/meetings/hooks/use-workspace-schedule';

export default function MeetingsHomeClient() {
  const { activeWorkspaceId } = useWorkspace();
  const [selectedBookingId, setSelectedBookingId] = React.useState<string | null>(null);

  // Unified reactive schedule stream & live KPI engine
  const {
    isLoading,
    rawBookings,
    todayEvents,
    upcomingWeekEvents,
    nextUpcomingSession,
    attendanceRate,
    attendanceSubtitle,
    unconfirmedBookings,
    sessionsMissingLink,
    isCalendarConnected,
    connectedCalendarCount,
    totalAttentionCount,
  } = useWorkspaceSchedule(activeWorkspaceId);

  // Resolve selected booking for the detail slide-over drawer
  const selectedBooking = React.useMemo(() => {
    if (!selectedBookingId) return null;
    return rawBookings.find(b => b.id === selectedBookingId) || null;
  }, [selectedBookingId, rawBookings]);

  const currentDateDisplay = React.useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  return (
    <>
      <div className="space-y-6 pb-16">
        {/* Date Context Indicator */}
        <div className="flex items-center justify-end -mt-2">
          <Badge variant="outline" className="text-xs font-semibold bg-muted/40 text-muted-foreground border-border/80">
            {currentDateDisplay}
          </Badge>
        </div>

        {/* Operational KPI Row (4 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Schedule */}
          <Card className="rounded-3xl border border-border/80 shadow-xs p-5 space-y-3 bg-card hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Today&apos;s Schedule
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-3xl font-black tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-8 w-12 rounded-lg" /> : todayEvents.length}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium truncate">
                {todayEvents.length === 0 ? (
                  'Clear schedule today'
                ) : (
                  <>
                    <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-emerald-600 font-semibold">{todayEvents.length} scheduled</span>
                    <span className="text-muted-foreground">
                      ({todayEvents.filter(e => e.sourceType === 'booking').length} 1:1, {todayEvents.filter(e => e.sourceType === 'meeting').length} group)
                    </span>
                  </>
                )}
              </p>
            </div>
          </Card>

          {/* Card 2: Upcoming This Week */}
          <Card className="rounded-3xl border border-border/80 shadow-xs p-5 space-y-3 bg-card hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Upcoming This Week
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-3xl font-black tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-8 w-12 rounded-lg" /> : upcomingWeekEvents.length}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Next 7 days horizon
              </p>
            </div>
          </Card>

          {/* Card 3: Attendance Rate */}
          <Card className="rounded-3xl border border-border/80 shadow-xs p-5 space-y-3 bg-card hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Attendance Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-3xl font-black tracking-tight text-emerald-600">
                {isLoading ? <Skeleton className="h-8 w-16 rounded-lg" /> : `${attendanceRate}%`}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                {attendanceSubtitle}
              </p>
            </div>
          </Card>

          {/* Card 4: Needs Attention */}
          <Card
            className={`rounded-3xl shadow-xs p-5 space-y-3 transition-shadow ${
              totalAttentionCount === 0
                ? 'border border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10'
                : 'border border-amber-200/50 bg-amber-50/10 dark:bg-amber-950/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  totalAttentionCount === 0
                    ? 'text-emerald-800 dark:text-emerald-400'
                    : 'text-amber-800 dark:text-amber-400'
                }`}
              >
                Needs Attention
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  totalAttentionCount === 0
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600'
                }`}
              >
                {totalAttentionCount === 0 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <div
                className={`text-3xl font-black tracking-tight ${
                  totalAttentionCount === 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {isLoading ? <Skeleton className="h-8 w-12 rounded-lg" /> : totalAttentionCount}
              </div>
              <p
                className={`text-[11px] font-medium truncate ${
                  totalAttentionCount === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {totalAttentionCount === 0
                  ? 'All systems operational'
                  : `${totalAttentionCount} actionable item${totalAttentionCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </Card>
        </div>

        {/* Main Operational Split: My Day (Left) vs Needs Attention & Sessions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: My Day Timeline (Span 7) */}
          <div className="lg:col-span-7 space-y-6">
            <MyDayTimeline
              items={todayEvents}
              isLoading={isLoading}
              onOpenBookingDetail={id => setSelectedBookingId(id)}
            />
          </div>

          {/* Right Column: Needs Attention & Upcoming Sessions (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <NeedsAttentionPanel
              unconfirmedBookings={unconfirmedBookings}
              sessionsMissingLink={sessionsMissingLink}
              isCalendarConnected={isCalendarConnected}
              connectedCount={connectedCalendarCount}
              isLoading={isLoading}
            />

            <UpcomingSessionsCard
              session={nextUpcomingSession}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Slide-over Booking Detail Drawer */}
      <BookingDetailDrawer
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={open => !open && setSelectedBookingId(null)}
      />
    </>
  );
}
