'use client';

/**
 * @fileOverview StandupsClient page controller (Phase 4B).
 *
 * Implements:
 * - Tab routing: My Standup, Team Overview, Blockers Manager, History.
 * - Reactive workspace-scoped Firestore subscriptions (Rule 1, Rule 2, Rule 9).
 * - Breadcrumbs: Operations / Standups.
 * - Mobile responsive tab layout with min-h-[44px] touch targets.
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { format } from 'date-fns';
import {
  CalendarDays,
  Users,
  AlertTriangle,
  History,
  CheckCircle2,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { StandupSubmission, BlockerRecord, Task, UserProfile } from '@/lib/types';
import { MyStandupView } from './components/MyStandupView';
import { TeamOverviewView } from './components/TeamOverviewView';
import { BlockersManagerView } from './components/BlockersManagerView';
import { StandupHistoryView } from './components/StandupHistoryView';

export default function StandupsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  // Active tab state
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState<string>(
    tabParam && ['my-standup', 'team', 'blockers', 'history'].includes(tabParam)
      ? tabParam
      : 'my-standup'
  );

  const [selectedDate, setSelectedDate] = React.useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Sync tab with URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`/admin/standups?${params.toString()}`, { scroll: false });
  };

  // Queries
  const standupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'standups'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const blockersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'blockers'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tasks'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('dueDate', 'asc'),
      limit(100)
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

  const { data: standupsRaw } = useCollection<StandupSubmission>(standupsQuery);
  const { data: blockersRaw } = useCollection<BlockerRecord>(blockersQuery);
  const { data: tasksRaw } = useCollection<Task>(tasksQuery);
  const { data: usersRaw } = useCollection<UserProfile>(usersQuery);

  const standups = React.useMemo(() => standupsRaw || [], [standupsRaw]);
  const blockers = React.useMemo(() => blockersRaw || [], [blockersRaw]);
  const tasks = React.useMemo(() => tasksRaw || [], [tasksRaw]);
  const teamMembers = React.useMemo(() => usersRaw || [], [usersRaw]);

  // Find user's draft or submission for selected date
  const myTodayStandup = React.useMemo(() => {
    if (!user?.uid) return null;
    return standups.find(
      (s) => s.userId === user.uid && s.date === selectedDate
    );
  }, [standups, user?.uid, selectedDate]);

  // Filter standups for selected date in Team Overview
  const dateStandups = React.useMemo(() => {
    return standups.filter((s) => s.date === selectedDate);
  }, [standups, selectedDate]);

  // Filter user's history
  const myHistory = React.useMemo(() => {
    if (!user?.uid) return [];
    return standups.filter((s) => s.userId === user.uid);
  }, [standups, user?.uid]);

  return (
    <div className="min-h-screen bg-background font-figtree p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Breadcrumb & Page Header */}
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
            <span className="text-foreground">Daily Standups</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Daily Standups & Commitments
            </h1>
            <CardInfoTooltip text="Daily standups capture accomplishments, daily commitments, blockers, and confidential notes with automated obstacle tracking." />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
          >
            <Link href="/admin/task-analytics">
              <Layers className="h-4 w-4 mr-1.5 text-primary" />
              Task Analytics
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-12 min-h-[48px] p-1 rounded-2xl bg-muted/30 border border-border/70 flex gap-1">
            <TabsTrigger
              value="my-standup"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              My Standup
            </TabsTrigger>

            <TabsTrigger
              value="team"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Team Overview
            </TabsTrigger>

            <TabsTrigger
              value="blockers"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Blockers
              {blockers.filter((b) => b.status === 'open' || b.status === 'escalated').length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {blockers.filter((b) => b.status === 'open' || b.status === 'escalated').length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="rounded-xl h-10 min-h-[40px] px-4 text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: My Standup */}
        <TabsContent value="my-standup" className="m-0 focus-visible:outline-none">
          <MyStandupView
            workspaceId={activeWorkspaceId || ''}
            initialDraft={myTodayStandup}
            tasks={tasks}
            onSubmitted={() => handleTabChange('team')}
          />
        </TabsContent>

        {/* Tab 2: Team Overview */}
        <TabsContent value="team" className="m-0 focus-visible:outline-none">
          <TeamOverviewView
            workspaceId={activeWorkspaceId || ''}
            standups={dateStandups}
            teamMembers={teamMembers}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </TabsContent>

        {/* Tab 3: Blockers */}
        <TabsContent value="blockers" className="m-0 focus-visible:outline-none">
          <BlockersManagerView
            workspaceId={activeWorkspaceId || ''}
            blockers={blockers}
          />
        </TabsContent>

        {/* Tab 4: History */}
        <TabsContent value="history" className="m-0 focus-visible:outline-none">
          <StandupHistoryView
            workspaceId={activeWorkspaceId || ''}
            standups={myHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
