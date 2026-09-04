'use client';

/**
 * @fileoverview Sales Performance & Intelligence 2.0 Main Dashboard Client.
 *
 * ARCHITECTURAL POINTER:
 * Orchestrates Phase 1 Performance Core:
 * - 4-Tab Architecture: Overview, Standings, Targets & Quotas, Rep Profiles.
 * - Time Range Switching: Today, Week, Month, Quarter.
 * - Workspace Scoping: Enforces activeWorkspaceId and activeWorkspace.organizationId.
 * - Seamless integration with Rule Engine Settings (/admin/settings/sales-performance).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing with zero 'any' or 'any[]'.
 * - Minimum 44px touch targets on mobile interactions.
 * - Conforms to next-best-practices, vercel-react-best-practices, and emilkowal-animations.
 */

import * as React from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/ui/page-container';
import {
  Flame,
  RefreshCw,
  Trophy,
  Target,
  Users,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import type { TimeRangeFilter, PerformanceOverviewData } from '@/lib/sales-performance/types';
import { getPerformanceOverviewAction } from '@/app/actions/sales-performance-actions';
import { PerformanceOverviewTab } from './components/PerformanceOverviewTab';
import { StandingsTableTab } from './components/StandingsTableTab';
import { TargetCenterTab } from './components/TargetCenterTab';
import { RepProfileTab } from './components/RepProfileTab';

export default function SalesEffortClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'overview' | 'standings' | 'targets' | 'reps'>('overview');
  const [timeRange, setTimeRange] = React.useState<TimeRangeFilter>('month');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [overviewData, setOverviewData] = React.useState<PerformanceOverviewData | null>(null);

  // Standings / Rep selection state
  const [selectedRepId, setSelectedRepId] = React.useState<string | null>(null);

  const fetchPerformanceData = React.useCallback(
    async (isManualRefresh = false) => {
      if (!activeWorkspaceId || !activeWorkspace?.organizationId) {
        setIsLoading(false);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const res = await getPerformanceOverviewAction({
          workspaceId: activeWorkspaceId,
          organizationId: activeWorkspace.organizationId,
          timeRange,
        });

        if (res.success && res.data) {
          setOverviewData(res.data);
          if (isManualRefresh) {
            toast({
              title: 'Dashboard Updated',
              description: `Performance metrics refreshed for ${timeRange} period.`,
            });
          }
        } else {
          throw new Error(res.error || 'Failed to load performance metrics.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching performance data.';
        console.error('[SalesEffortClient] Error fetching data:', err);
        toast({
          variant: 'destructive',
          title: 'Unable to Load Performance Data',
          description: msg,
          actionConfig: { path: '/admin/analytics/sales-effort', label: 'Reload Dashboard' },
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeWorkspaceId, activeWorkspace?.organizationId, timeRange, toast]
  );

  React.useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const handleSelectRepFromOverview = (repId: string) => {
    setSelectedRepId(repId);
    setActiveTab('reps');
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-24 w-full text-left">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500 fill-current animate-pulse" />
                Sales Performance & Intelligence
              </h1>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30">
                2.0
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Multi-dimensional sales performance scoring, real-time quota pacing, and operational audit trail.
            </p>
          </div>

          {/* Time Range Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Range Filter Pills */}
            <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/30">
              {(['today', 'week', 'month', 'quarter'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-150 min-h-[36px] sm:min-h-[32px] active:scale-[0.97] ${
                    timeRange === r
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchPerformanceData(true)}
              disabled={isRefreshing || isLoading}
              className="rounded-xl h-9 w-9 active:scale-[0.97]"
              title="Refresh performance data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </Button>

            {/* Link to Command Center */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold active:scale-[0.97]"
            >
              <Link href="/admin/sales-command">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-primary" /> Command Center
              </Link>
            </Button>

            {/* Link to My Day Workspace */}
            <Button
              asChild
              variant="default"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold active:scale-[0.97]"
            >
              <Link href="/admin/my-day">
                <Flame className="h-3.5 w-3.5 mr-1.5 text-orange-400 fill-current" /> My Day
              </Link>
            </Button>

            {/* Link to Scoring Rules Settings */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold active:scale-[0.97]"
            >
              <Link href="/admin/settings/sales-performance">
                <Settings className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Rules
              </Link>
            </Button>
          </div>
        </div>

        {/* 4-Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'overview' | 'standings' | 'targets' | 'reps')}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto p-1 bg-muted/40 rounded-2xl border border-border/30">
            <TabsTrigger
              value="overview"
              className="rounded-xl text-xs font-bold py-2.5 min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="standings"
              className="rounded-xl text-xs font-bold py-2.5 min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <Trophy className="h-3.5 w-3.5" /> Standings
            </TabsTrigger>
            <TabsTrigger
              value="targets"
              className="rounded-xl text-xs font-bold py-2.5 min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <Target className="h-3.5 w-3.5" /> Quotas & Targets
            </TabsTrigger>
            <TabsTrigger
              value="reps"
              className="rounded-xl text-xs font-bold py-2.5 min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <Users className="h-3.5 w-3.5" /> Rep Profiles
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
            <PerformanceOverviewTab
              overviewData={overviewData}
              isLoading={isLoading}
              onSelectRep={handleSelectRepFromOverview}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </TabsContent>

          {/* Tab 2: Standings */}
          <TabsContent value="standings" className="mt-0 focus-visible:outline-none">
            {activeWorkspaceId ? (
              <StandingsTableTab
                workspaceId={activeWorkspaceId}
                leaderboard={overviewData?.leaderboard || []}
                selectedRepId={selectedRepId}
                onSelectRep={setSelectedRepId}
              />
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
                Please select an active workspace.
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Targets & Quotas */}
          <TabsContent value="targets" className="mt-0 focus-visible:outline-none">
            {activeWorkspaceId && activeWorkspace?.organizationId ? (
              <TargetCenterTab
                workspaceId={activeWorkspaceId}
                organizationId={activeWorkspace.organizationId}
                targets={overviewData?.activeTargets || []}
                currentUserId={user?.uid}
                onRefresh={() => fetchPerformanceData(true)}
              />
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
                Please select an active workspace.
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Rep Profiles & Coaching */}
          <TabsContent value="reps" className="mt-0 focus-visible:outline-none">
            {activeWorkspaceId ? (
              <RepProfileTab
                workspaceId={activeWorkspaceId}
                reps={overviewData?.leaderboard || []}
                onOpenLedger={(repId) => {
                  setSelectedRepId(repId);
                  setActiveTab('standings');
                }}
              />
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
                Please select an active workspace.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
