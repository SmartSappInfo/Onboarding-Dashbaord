'use client';

/**
 * @fileoverview SmartSapp Seller Workspace ("My Day") Main Client Component (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Sections 30–35 & UI Sections 12–25:
 * - Unified command center for the day: Greeting, Performance Snapshot Strip,
 *   Hero "DO THIS NOW" Card, Prioritized Work Queue, and Schedule Widget.
 * - Multi-Factor Next-Best-Action ranking computed server-side via priority-engine.ts.
 * - "Action-from-the-surface" paradigm: Executes calls, notes, task completions, and snoozes
 *   without navigating away, instantly awarding effort points via evaluateEffortEvent.
 * - Dynamic queue promotion: Completing or snoozing an item instantly promotes the next
 *   ranked item without full page reloads.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero 'any' or 'any[]'.
 * - Minimum 44px touch targets on mobile viewports.
 * - Conform to Emil Kowalski micro-interactions (active:scale-[0.97]).
 */

import * as React from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Flame,
  RefreshCw,
  Trophy,
  Target,
  Calendar,
  Clock,
  Sparkles,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type {
  MyDayOverview,
  WorkQueueItem,
  QuickActionResult,
} from '@/lib/seller-workspace/types';
import {
  getMyDayOverviewAction,
  executeQuickActionAction,
  snoozeQueueItemAction,
  dismissQueueItemAction,
} from '@/app/actions/seller-workspace-actions';
import { DoThisNowCard } from './components/DoThisNowCard';
import { WorkQueueList } from './components/WorkQueueList';
import { ActionExecutionDrawer } from './components/ActionExecutionDrawer';

export default function MyDayClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [overview, setOverview] = React.useState<MyDayOverview | null>(null);

  // Drawer state for action execution
  const [drawerItem, setDrawerItem] = React.useState<WorkQueueItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = React.useState<boolean>(false);

  // 1. Ingestion: Fetch My Day Overview
  const fetchMyDayData = React.useCallback(
    async (isManualRefresh = false) => {
      if (!activeWorkspaceId || !activeWorkspace?.organizationId || !user?.uid) {
        setIsLoading(false);
        return;
      }

      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await getMyDayOverviewAction({
          workspaceId: activeWorkspaceId,
          organizationId: activeWorkspace.organizationId,
          repId: user.uid,
        });

        if (res.success && res.data) {
          setOverview(res.data);
        } else {
          toast({
            variant: 'destructive',
            title: 'Failed to load My Day',
            description: res.error || 'Could not fetch your daily agenda.',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: msg,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeWorkspaceId, activeWorkspace?.organizationId, user?.uid, toast]
  );

  React.useEffect(() => {
    fetchMyDayData();
  }, [fetchMyDayData]);

  // Helper: Advance queue locally after completion/snooze/dismiss
  const handleRemoveQueueItem = React.useCallback(
    (itemId: string, pointsEarned = 0) => {
      setOverview((prev) => {
        if (!prev) return null;

        const updatedQueue = prev.queue.filter((item) => item.id !== itemId);
        const wasTopPriority = prev.topPriority?.id === itemId;

        // If top priority was resolved, promote next available item in queue
        let newTopPriority: WorkQueueItem | null = prev.topPriority;
        if (wasTopPriority) {
          newTopPriority = updatedQueue.length > 0 ? updatedQueue[0] : null;
        }

        return {
          ...prev,
          topPriority: newTopPriority,
          queue: updatedQueue,
          snapshot: {
            ...prev.snapshot,
            todayPointsEarned: prev.snapshot.todayPointsEarned + pointsEarned,
            completedActionsToday: prev.snapshot.completedActionsToday + 1,
            pendingActionsToday: Math.max(0, prev.snapshot.pendingActionsToday - 1),
          },
        };
      });
    },
    []
  );

  // 2. Action Drawer triggers
  const handleOpenActionDrawer = (item: WorkQueueItem) => {
    setDrawerItem(item);
    setIsDrawerOpen(true);
  };

  // 3. Quick 1-Click Complete
  const handleQuickComplete = async (item: WorkQueueItem) => {
    if (!activeWorkspaceId || !activeWorkspace?.organizationId || !user?.uid) return;

    setIsActionLoading(true);
    try {
      const res: QuickActionResult = await executeQuickActionAction({
        itemId: item.id,
        actionType: 'task_complete',
        workspaceId: activeWorkspaceId,
        organizationId: activeWorkspace.organizationId,
        actorId: user.uid,
      });

      if (res.success) {
        const points = res.pointsEarned || 0;
        toast({
          title: 'Action Completed',
          description: points > 0 ? `Logged effort! (+${points} pts)` : 'Task completed.',
        });
        handleRemoveQueueItem(item.id, points);
      } else {
        throw new Error(res.error || 'Failed to complete task');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Completion Failed',
        description: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // 4. Snooze handler
  const handleSnooze = async (item: WorkQueueItem, hours: number) => {
    if (!activeWorkspaceId) return;

    setIsActionLoading(true);
    try {
      const res = await snoozeQueueItemAction({
        workspaceId: activeWorkspaceId,
        itemId: item.id,
        snoozeHours: hours,
      });

      if (res.success) {
        toast({
          title: 'Item Snoozed',
          description: `Postponed for ${hours}h.`,
        });
        handleRemoveQueueItem(item.id);
      } else {
        throw new Error(res.error || 'Could not snooze item');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Snooze Failed',
        description: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // 5. Dismiss handler
  const handleDismiss = async (item: WorkQueueItem) => {
    if (!activeWorkspaceId) return;

    setIsActionLoading(true);
    try {
      const res = await dismissQueueItemAction({
        workspaceId: activeWorkspaceId,
        itemId: item.id,
      });

      if (res.success) {
        toast({
          title: 'Item Dismissed',
          description: 'Removed from your work queue.',
        });
        handleRemoveQueueItem(item.id);
      } else {
        throw new Error(res.error || 'Could not dismiss item');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Dismiss Failed',
        description: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const snapshot = overview?.snapshot;

  return (
    <PageContainer maxWidth="7xl" className="space-y-6">
      {/* 1. Header Greeting & Performance Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {overview?.greeting || 'Good day'}, {overview?.repProfile?.userName || user?.displayName || 'Seller'}
            </span>
            <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
              Seller Workspace
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {overview?.dateString || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} • AI Prioritized Agenda
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMyDayData(true)}
            disabled={isRefreshing}
            className="rounded-xl min-h-[44px] text-xs font-bold active:scale-[0.97] transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            asChild
            variant="secondary"
            size="sm"
            className="rounded-xl min-h-[44px] text-xs font-bold active:scale-[0.97] transition-all"
          >
            <Link href="/admin/analytics/sales-effort">
              <Trophy className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Standings
              <ArrowRight className="h-3 w-3 ml-1 opacity-70" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl min-h-[44px] text-xs font-bold active:scale-[0.97] transition-all"
          >
            <Link href="/admin/sales-command">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Command Center
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Performance Snapshot Strip (UI Section 12 & PRD Section 30) */}
      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Metric 1: Performance Index */}
          <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Performance Index</span>
                <Flame className="h-4 w-4 text-orange-500 fill-current" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
                  {snapshot.performanceIndex}
                </span>
                <span className="text-xs text-muted-foreground font-bold">/ 100</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium truncate">
                Phase 1 composite score
              </p>
            </CardContent>
          </Card>

          {/* Metric 2: Target Attainment */}
          <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Target Attainment</span>
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
                  {snapshot.targetAttainmentPercent}%
                </span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${Math.min(snapshot.targetAttainmentPercent, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Metric 3: Today's Effort Points */}
          <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Today&apos;s Effort</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
                  {snapshot.todayPointsEarned}
                </span>
                <span className="text-xs text-muted-foreground font-bold">
                  / {snapshot.todayPointsTarget} pts
                </span>
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                {snapshot.completedActionsToday} actions logged today
              </p>
            </CardContent>
          </Card>

          {/* Metric 4: Active Pipeline */}
          <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-3.5 sm:p-4 shadow-sm">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-[10px] tracking-wider">Active Pipeline</span>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono truncate">
                  {snapshot.activePipelineValue.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground font-bold">GHS</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium truncate">
                {snapshot.dailyRequiredPace > 0
                  ? `Required pace: ${snapshot.dailyRequiredPace}/day`
                  : 'On target pace'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Hero Next-Best-Action & Filterable Work Queue */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section: 🔥 DO THIS NOW Card */}
          <DoThisNowCard
            item={overview?.topPriority || null}
            onOpenActionDrawer={handleOpenActionDrawer}
            onQuickComplete={handleQuickComplete}
            onSnooze={handleSnooze}
            onDismiss={handleDismiss}
            isActionLoading={isActionLoading}
          />

          {/* Section: Filterable Ranked Work Queue */}
          <WorkQueueList
            items={overview?.queue || []}
            topPriorityId={overview?.topPriority?.id}
            onOpenActionDrawer={handleOpenActionDrawer}
            onQuickComplete={handleQuickComplete}
            onSnooze={handleSnooze}
            onDismiss={handleDismiss}
            isActionLoading={isActionLoading}
          />
        </div>

        {/* Right Column (4 cols): Context, Upcoming Schedule, SLA Summary */}
        <div className="lg:col-span-4 space-y-6">
          {/* Widget 1: Today's Schedule & Meetings */}
          <Card className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-extrabold text-foreground tracking-tight">
                  Today&apos;s Schedule
                </h4>
              </div>
              <Badge variant="secondary" className="font-mono text-[11px] font-bold">
                {overview?.upcomingMeetings?.length || 0}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {overview?.upcomingMeetings && overview.upcomingMeetings.length > 0 ? (
                overview.upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-primary">
                      <span>{meeting.startTime} - {meeting.endTime}</span>
                      {meeting.attendeesCount > 0 && (
                        <span className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                          <Users className="h-3 w-3" /> {meeting.attendeesCount}
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-foreground leading-snug">
                      {meeting.title}
                    </h5>
                    {meeting.dealContext && (
                      <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        Deal: {meeting.dealContext.name} ({meeting.dealContext.value.toLocaleString()} GHS)
                      </div>
                    )}
                    {meeting.brief && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {meeting.brief}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center space-y-1.5">
                  <Calendar className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-bold text-foreground">No meetings scheduled today</p>
                  <p className="text-[11px] text-muted-foreground">
                    Your calendar is open. Focus on pipeline discovery calls!
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Widget 2: SLA Health & Urgency Breakdown */}
          {overview?.slaSummary && (
            <Card className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-extrabold text-foreground tracking-tight">
                    SLA Commitment
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {overview.slaSummary.onTrackCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                    On Track
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                    {overview.slaSummary.atRiskCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                    At Risk
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                    {overview.slaSummary.breachedCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                    Breached
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Widget 3: Quick Navigation to Target Center */}
          <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.03] to-background p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <Sparkles className="h-4 w-4" /> AI Coaching Recommendation
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Complete {Math.max(1, (overview?.snapshot.todayPointsTarget || 25) - (overview?.snapshot.todayPointsEarned || 0))} more effort points today to stay above your team quota deficit threshold.
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full rounded-xl min-h-[40px] text-xs font-bold active:scale-[0.97] transition-all"
            >
              <Link href="/admin/analytics/sales-effort">
                View Full Team Leaderboard
              </Link>
            </Button>
          </Card>
        </div>
      </div>

      {/* 4. Action Execution Drawer ("Action from the surface") */}
      {activeWorkspaceId && activeWorkspace?.organizationId && user?.uid && (
        <ActionExecutionDrawer
          item={drawerItem}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setDrawerItem(null);
          }}
          workspaceId={activeWorkspaceId}
          organizationId={activeWorkspace.organizationId}
          actorId={user.uid}
          onActionComplete={(itemId, points) => {
            handleRemoveQueueItem(itemId, points);
            setIsDrawerOpen(false);
            setDrawerItem(null);
          }}
        />
      )}
    </PageContainer>
  );
}
