'use client';

/**
 * @fileoverview Executive Analytics & Heatmap Studio (Meetings 2.0).
 * Dedicated operational intelligence studio providing host capacity radar,
 * booking conversion funnels, and 24-hour peak scheduling heatmaps.
 *
 * ARCHITECTURE & DESIGN SYSTEM ALIGNMENT:
 * - Strictly conforms to theme.md §8 (Standardized header taxonomy, zero raw descriptions).
 * - Universal <CardInfoTooltip> in card headers with sr-only <CardDescription>.
 * - Mobile touch targets >= 44px (or responsive sm:min-h-[36px]).
 * - High contrast rounded-2xl card surfaces (sm:rounded-2xl border border-border/80 bg-card).
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarCheck,
  Video,
  Clock,
  CheckCircle2,
  Users,
  TrendingUp,
  BarChart3,
  Flame,
  Filter,
  UserCheck,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  getMeetingsOperationalOverviewAction,
  type OperationalOverviewResult,
} from '@/app/actions/meeting-analytics-actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function OverviewClient() {
  const { activeWorkspaceId } = useWorkspace();
  const [data, setData] = React.useState<OperationalOverviewResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchOverview = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingsOperationalOverviewAction(activeWorkspaceId);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('[fetchOverview]', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const peakHours = data?.peakHours || [];
  const hostWorkloads = data?.hostWorkloads || [];

  // Calculate highest peak hour
  const maxBookingCount = Math.max(1, ...peakHours.map(p => p.count));
  const busiestHour = peakHours.slice().sort((a, b) => b.count - a.count)[0];

  // Distribution buckets (Morning: 6-12, Afternoon: 12-18, Evening: 18-24 & 0-6)
  const morningCount = peakHours.filter(p => p.hour >= 6 && p.hour < 12).reduce((s, p) => s + p.count, 0);
  const afternoonCount = peakHours.filter(p => p.hour >= 12 && p.hour < 18).reduce((s, p) => s + p.count, 0);
  const eveningCount = peakHours.filter(p => p.hour >= 18 || p.hour < 6).reduce((s, p) => s + p.count, 0);
  const totalBookingsCalculated = morningCount + afternoonCount + eveningCount || 1;

  // Total workspace meeting hours across all hosts
  const totalHostMinutes = hostWorkloads.reduce((sum, h) => sum + h.totalMinutes, 0) || 1;

  // Funnel calculations
  const funnelTotalBookings = kpis?.totalBookings || 0;
  const funnelCompleted = kpis?.completedMeetingsCount || 0;
  const funnelNoShows = kpis?.noShowCount || 0;
  const funnelEvaluated = funnelCompleted + funnelNoShows;
  const attendanceRate = kpis?.overallAttendanceRate ?? 100;
  const completionRate = funnelTotalBookings > 0
    ? Math.min(100, Math.round((funnelCompleted / funnelTotalBookings) * 100))
    : 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
              Executive Analytics & Studio
            </h1>
            <CardInfoTooltip text="Workspace-wide operational intelligence analyzing team host workload, multi-stage booking conversion funnels, and 24-hour scheduling density." />
          </div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">
            Operational Intelligence & Capacity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/meetings/calendar">
            <Button variant="outline" size="sm" className="rounded-xl min-h-[44px] sm:min-h-[36px] font-bold text-xs gap-1.5 active:scale-[0.97]">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Calendar Matrix
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border/80 shadow-sm p-4 flex flex-col justify-between bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Meeting Volume</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalMeetingHours || 0} hrs
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total consultation & webinar airtime</p>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm p-4 flex flex-col justify-between bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Client 1:1 Bookings</span>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalBookings || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Self-scheduled client appointments</p>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm p-4 flex flex-col justify-between bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Overall Attendance Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground flex items-center gap-1.5">
              {attendanceRate}%
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {funnelCompleted} completed • {funnelNoShows} no-shows
            </p>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm p-4 flex flex-col justify-between bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Active Group Sessions</span>
            <Video className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalScheduledMeetings || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active webinars & orientation halls</p>
          </div>
        </Card>
      </div>

      {/* Row 1: Host Workload & Capacity Radar + Booking Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Team Host Workload & Capacity Radar (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-bold text-foreground">
                  Team Host Workload & Capacity Radar
                </CardTitle>
                <CardInfoTooltip text="Proportional distribution of meeting volume and airtime hosted across workspace team members." />
                <CardDescription className="sr-only">Team host workload breakdown</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold">
                {hostWorkloads.length} Active Host{hostWorkloads.length === 1 ? '' : 's'}
              </Badge>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
              {hostWorkloads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <Users className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-semibold text-foreground">No host workload data recorded yet</p>
                  <p className="text-xs">Schedule meetings or assign event types to populate host capacity metrics.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hostWorkloads.map(host => {
                    const sharePct = Math.round((host.totalMinutes / totalHostMinutes) * 100);
                    const hours = Math.round((host.totalMinutes / 60) * 10) / 10;
                    return (
                      <div key={host.hostUserId} className="p-3 rounded-xl border border-border/70 bg-muted/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {host.hostName ? host.hostName.slice(0, 2).toUpperCase() : 'HO'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-foreground truncate block">
                                {host.hostName}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {host.totalMeetings} session{host.totalMeetings === 1 ? '' : 's'} • {hours} hrs
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={sharePct > 40 ? 'default' : 'secondary'} 
                              className="text-[10px] font-bold tabular-nums"
                            >
                              {sharePct}% Capacity
                            </Badge>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              sharePct > 50 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.max(4, sharePct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3 bg-muted/10 rounded-xl border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Accumulated Airtime:</span>
                <strong className="text-foreground font-bold">{Math.round((totalHostMinutes / 60) * 10) / 10} hours</strong>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Booking Conversion Funnel (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-base font-bold text-foreground">
                  Booking Conversion Funnel
                </CardTitle>
                <CardInfoTooltip text="Multi-stage progression from initial reservation inquiry through to attended and completed consultation." />
                <CardDescription className="sr-only">Booking conversion funnel stages</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {completionRate}% Completion
              </Badge>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {/* Funnel Stage 1: Initiated */}
                <div className="p-3 rounded-xl border border-border/70 bg-muted/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      1. Bookings Initiated
                    </span>
                    <strong className="text-foreground font-bold">{funnelTotalBookings} (100%)</strong>
                  </div>
                  <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full w-full" />
                  </div>
                </div>

                <div className="flex justify-center -my-1">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
                </div>

                {/* Funnel Stage 2: Confirmed Appointments */}
                <div className="p-3 rounded-xl border border-border/70 bg-muted/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                      2. Confirmed & Scheduled
                    </span>
                    <strong className="text-foreground font-bold">{funnelTotalBookings} (100%)</strong>
                  </div>
                  <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/80 rounded-full w-full" />
                  </div>
                </div>

                <div className="flex justify-center -my-1">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
                </div>

                {/* Funnel Stage 3: Attended (No No-Show) */}
                <div className="p-3 rounded-xl border border-border/70 bg-muted/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                      3. Attended Sessions
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {funnelCompleted} ({attendanceRate}%)
                    </strong>
                  </div>
                  <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(4, attendanceRate)}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 text-xs text-muted-foreground flex items-center justify-between">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Reliability Health:</span>
                <span className="text-foreground font-bold">
                  {funnelNoShows === 0 ? 'Zero No-Shows Recorded' : `${funnelNoShows} No-Shows Logged`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: 24-Hour Peak Booking Hours Heatmap */}
      <Card className="rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base font-bold text-foreground">
              Peak Booking & Scheduling Hours Heatmap
            </CardTitle>
            <CardInfoTooltip text="24-hour visual intensity grid illustrating scheduling density across the day to optimize availability windows." />
            <CardDescription className="sr-only">24-hour booking density heatmap</CardDescription>
          </div>
          {busiestHour && busiestHour.count > 0 && (
            <Badge variant="secondary" className="text-xs font-bold gap-1 w-fit bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Flame className="h-3 w-3" />
              Peak Activity: {busiestHour.label} ({busiestHour.count} booking{busiestHour.count === 1 ? '' : 's'})
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* 24-Hour Heatmap Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {peakHours.map(bucket => {
              const intensity = bucket.count > 0 ? bucket.count / maxBookingCount : 0;
              return (
                <div
                  key={bucket.hour}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 select-none",
                    bucket.count === 0 && "bg-muted/10 border-border/50 text-muted-foreground/50",
                    bucket.count > 0 && intensity < 0.35 && "bg-primary/10 border-primary/20 text-foreground font-semibold shadow-xs",
                    bucket.count > 0 && intensity >= 0.35 && intensity < 0.75 && "bg-primary/30 border-primary/40 text-foreground font-bold shadow-xs",
                    bucket.count > 0 && intensity >= 0.75 && "bg-primary text-primary-foreground border-primary font-black shadow-md ring-1 ring-primary/30"
                  )}
                  title={`${bucket.label} — ${bucket.count} booking(s)`}
                >
                  <span className="text-[10px] font-mono opacity-80 block">{bucket.label}</span>
                  <span className="text-sm font-bold mt-1 block tabular-nums">{bucket.count}</span>
                </div>
              );
            })}
          </div>

          {/* Time-of-Day Distribution Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
            <div className="p-3 rounded-xl bg-muted/15 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <div>
                  <span className="text-xs font-bold text-foreground block">Morning (06:00 - 12:00)</span>
                  <span className="text-[10px] text-muted-foreground">Early consultation blocks</span>
                </div>
              </div>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {morningCount} ({Math.round((morningCount / totalBookingsCalculated) * 100)}%)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/15 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sunset className="h-4 w-4 text-orange-500" />
                <div>
                  <span className="text-xs font-bold text-foreground block">Afternoon (12:00 - 18:00)</span>
                  <span className="text-[10px] text-muted-foreground">Peak executive meetings</span>
                </div>
              </div>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {afternoonCount} ({Math.round((afternoonCount / totalBookingsCalculated) * 100)}%)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/15 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-500" />
                <div>
                  <span className="text-xs font-bold text-foreground block">Evening & Night</span>
                  <span className="text-[10px] text-muted-foreground">Webinars & late follow-ups</span>
                </div>
              </div>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {eveningCount} ({Math.round((eveningCount / totalBookingsCalculated) * 100)}%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
