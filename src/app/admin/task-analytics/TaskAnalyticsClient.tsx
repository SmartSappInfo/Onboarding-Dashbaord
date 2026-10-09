'use client';

/**
 * @fileOverview TaskAnalyticsClient page controller (Phase 4C).
 *
 * Implements:
 * - Period selector (7d, 30d, 90d, all).
 * - Real-time metric aggregation via calculateTaskAnalytics.
 * - Tabs: Overview, Execution Velocity, Team Workload, Blockers & MTTR.
 * - Drill-down links to /admin/tasks and /admin/standups.
 * - Mobile responsive navigation with min-h-[44px] touch targets.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { subDays, format } from 'date-fns';
import {
  BarChart3,
  Calendar,
  Layers,
  ArrowLeft,
  Users,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { safeParseDate } from '@/lib/utils/date-utils';
import { calculateTaskAnalytics } from '@/lib/analytics/task-analytics-service';
import type { Task, BlockerRecord, UserProfile } from '@/lib/types';
import { AnalyticsOverviewTab } from './components/AnalyticsOverviewTab';
import { AnalyticsExecutionTab } from './components/AnalyticsExecutionTab';
import { AnalyticsWorkloadTab } from './components/AnalyticsWorkloadTab';
import { AnalyticsBlockersTab } from './components/AnalyticsBlockersTab';

export default function TaskAnalyticsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [period, setPeriod] = React.useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [activeTab, setActiveTab] = React.useState('overview');

  // Firestore Queries
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tasks'),
      where('workspaceId', '==', activeWorkspaceId),
      limit(500)
    );
  }, [firestore, activeWorkspaceId]);

  const blockersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'blockers'),
      where('workspaceId', '==', activeWorkspaceId),
      limit(200)
    );
  }, [firestore, activeWorkspaceId]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspace?.organizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeWorkspace.organizationId),
      limit(200)
    );
  }, [firestore, activeWorkspace?.organizationId]);

  const { data: tasksRaw } = useCollection<Task>(tasksQuery);
  const { data: blockersRaw } = useCollection<BlockerRecord>(blockersQuery);
  const { data: usersRaw } = useCollection<UserProfile>(usersQuery);

  const allTasks = React.useMemo(() => tasksRaw || [], [tasksRaw]);
  const allBlockers = React.useMemo(() => blockersRaw || [], [blockersRaw]);
  const teamMembers = React.useMemo(() => usersRaw || [], [usersRaw]);

  // Filter tasks and blockers by period
  const filteredTasks = React.useMemo(() => {
    if (period === 'all') return allTasks;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const cutoff = subDays(new Date(), days);

    return allTasks.filter((t) => {
      const created = safeParseDate(t.createdAt);
      return created ? created >= cutoff : true;
    });
  }, [allTasks, period]);

  const analytics = React.useMemo(() => {
    return calculateTaskAnalytics(filteredTasks, allBlockers);
  }, [filteredTasks, allBlockers]);

  return (
    <div className="min-h-screen bg-background font-figtree p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Link
              href="/admin/tasks"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tasks & Operations
            </Link>
            <span>/</span>
            <span className="text-foreground">Task Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Operational Insights & Analytics
            </h1>
            <CardInfoTooltip text="Live metrics for team throughput, delivery cycle time, workload density, and blocker resolution velocity." />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            asChild
            variant="outline"
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
          >
            <Link href="/admin/standups">
              <Calendar className="h-4 w-4 mr-1.5 text-primary" />
              Standups & Feed
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
          >
            <Link href="/admin/tasks">
              <Layers className="h-4 w-4 mr-1.5" />
              Task Registry
            </Link>
          </Button>
        </div>
      </div>

      {/* Period Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={period === p.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p.id)}
              className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center">
          <Badge variant="outline" className="text-[11px] font-medium border-border/80">
            {filteredTasks.length} tasks analyzed
          </Badge>
          <span className="text-[11px]">
            Updated {format(new Date(analytics.freshnessTimestamp), 'p')}
          </span>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-12 min-h-[48px] p-1 rounded-2xl bg-muted/30 border border-border/70 flex gap-1">
            <TabsTrigger
              value="overview"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>

            <TabsTrigger
              value="execution"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              Execution & Velocity
            </TabsTrigger>

            <TabsTrigger
              value="workload"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Team Workload
            </TabsTrigger>

            <TabsTrigger
              value="blockers"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Blockers & MTTR
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0 focus-visible:outline-none">
          <AnalyticsOverviewTab analytics={analytics} />
        </TabsContent>

        <TabsContent value="execution" className="m-0 focus-visible:outline-none">
          <AnalyticsExecutionTab analytics={analytics} />
        </TabsContent>

        <TabsContent value="workload" className="m-0 focus-visible:outline-none">
          <AnalyticsWorkloadTab analytics={analytics} teamMembers={teamMembers} />
        </TabsContent>

        <TabsContent value="blockers" className="m-0 focus-visible:outline-none">
          <AnalyticsBlockersTab analytics={analytics} blockers={allBlockers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
