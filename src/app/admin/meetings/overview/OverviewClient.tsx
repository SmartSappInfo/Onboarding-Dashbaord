'use client';

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
  AlertCircle,
  Users,
  BarChart3,
  ExternalLink,
  Plus,
  Play,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getMeetingsOperationalOverviewAction,
  type OperationalOverviewResult,
} from '@/app/actions/meeting-analytics-actions';
import { format } from 'date-fns';
import Link from 'next/link';

export function OverviewClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

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
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const todayMeetings = data?.todayMeetings || [];
  const attention = data?.requiresAttention;
  const hostWorkloads = data?.hostWorkloads || [];

  return (
    <div className="space-y-6">
      {/* Top 4 Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Meetings</span>
            <Video className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalScheduledMeetings || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active & upcoming sessions</p>
          </div>
        </Card>

        <Card className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Bookings</span>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalBookings || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Self-scheduled reservations</p>
          </div>
        </Card>

        <Card className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Attendance Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground flex items-center gap-1.5">
              {kpis?.overallAttendanceRate || 100}%
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpis?.completedMeetingsCount || 0} completed • {kpis?.noShowCount || 0} no-shows</p>
          </div>
        </Card>

        <Card className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Meeting Volume</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">
              {kpis?.totalMeetingHours || 0} hrs
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total consultation time</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Today's Agenda + Requires Attention & Workloads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Agenda Roster */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Today's Schedule & Action Roster
                </CardTitle>
                <CardDescription className="text-xs">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </CardDescription>
              </div>
              <Link href="/admin/meetings/calendar">
                <Button variant="ghost" size="sm" className="text-xs rounded-xl gap-1">
                  Full Calendar
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {todayMeetings.length === 0 ? (
                <div className="text-center py-10 space-y-2 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-semibold text-foreground">No meetings scheduled for today</p>
                  <p className="text-xs">Enjoy your open focus time or schedule an instant session.</p>
                </div>
              ) : (
                todayMeetings.map(meeting => (
                  <div
                    key={meeting.id}
                    className="p-3.5 rounded-2xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{meeting.title}</span>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {meeting.duration}m
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(meeting.meetingTime), 'p')} • Host: {meeting.hostName} • {meeting.locationType.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {meeting.joinUrl && (
                        <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="sm"
                            className="h-8 rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
                          >
                            <Play className="h-3 w-3" />
                            Join
                          </Button>
                        </a>
                      )}
                      <Link href={`/admin/meetings/${meeting.id}`}>
                        <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs active:scale-[0.97]">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Requires Attention & Host Workloads */}
        <div className="space-y-6">
          {/* Requires Attention */}
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Requires Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Missing video links:</span>
                <strong className="text-foreground">{attention?.noVideoLinkCount || 0}</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">No-show follow-ups needed:</span>
                <strong className="text-foreground">{attention?.overdueFollowupsCount || 0}</strong>
              </div>
            </CardContent>
          </Card>

          {/* Host Workloads */}
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Team Host Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {hostWorkloads.length === 0 ? (
                <p className="text-xs text-muted-foreground">No host metrics recorded yet.</p>
              ) : (
                hostWorkloads.slice(0, 4).map(host => (
                  <div key={host.hostUserId} className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[120px]">
                      {host.hostName}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      <strong>{host.totalMeetings}</strong> meetings ({Math.round((host.totalMinutes / 60) * 10) / 10}h)
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
