'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Domain Agents & Swarm Hub Container
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Viewport Hub:
 *    - Unifies Specialist Roster, Swarm Mission Control, Synthesis, and History in a tabbed UX.
 * 2. Mobile Accessibility:
 *    - Strict minimum interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Smooth transitions, `active:scale-[0.97]` on buttons, clear focus rings.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Sparkles,
  History,
} from 'lucide-react';
import type {
  SpecialistDescriptor,
  SpecialistWorkspaceConfig,
  DomainSpecialistId,
  SwarmRun,
} from '@/lib/agents/domain-types';
import { SpecialistRosterGrid } from './SpecialistRosterGrid';
import { SpecialistDetailDrawer } from './SpecialistDetailDrawer';
import { SwarmMissionControl } from './SwarmMissionControl';
import { SwarmSynthesisCard } from './SwarmSynthesisCard';
import { SwarmRunsHistoryTable } from './SwarmRunsHistoryTable';
import { listSpecialistsAction, listSwarmRunsAction } from '@/lib/agents/actions/domain-agent-actions';

export interface DomainAgentsHubProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
}

export function DomainAgentsHub({
  workspaceId,
  organizationId,
  userId,
}: DomainAgentsHubProps) {
  const [specialists, setSpecialists] = React.useState<SpecialistDescriptor[]>([]);
  const [runs, setRuns] = React.useState<SwarmRun[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'roster' | 'swarm' | 'history'>('roster');

  // Detail Drawer state
  const [selectedSpecialist, setSelectedSpecialist] = React.useState<SpecialistDescriptor | null>(null);
  const [drawerConfig, setDrawerConfig] = React.useState<SpecialistWorkspaceConfig | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Active Swarm Run for Synthesis View
  const [activeRun, setActiveRun] = React.useState<SwarmRun | null>(null);
  const [quickDispatchId, setQuickDispatchId] = React.useState<DomainSpecialistId | undefined>(undefined);

  // Fetch initial data
  React.useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [specRes, runsRes] = await Promise.all([
          listSpecialistsAction(workspaceId),
          listSwarmRunsAction(workspaceId, 20),
        ]);

        if (isMounted) {
          if (specRes.success && specRes.data) {
            setSpecialists(specRes.data);
          }
          if (runsRes.success && runsRes.data) {
            setRuns(runsRes.data);
            if (runsRes.data.length > 0 && !activeRun) {
              setActiveRun(runsRes.data[0]);
            }
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const handleOpenDrawer = (spec: SpecialistDescriptor) => {
    setSelectedSpecialist(spec);
    setIsDrawerOpen(true);
  };

  const handleQuickDispatch = (specId: DomainSpecialistId) => {
    setQuickDispatchId(specId);
    setActiveTab('swarm');
  };

  const handleMissionCompleted = (run: SwarmRun) => {
    setActiveRun(run);
    setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Banner & Stats */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/30 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-100/70 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 text-xs uppercase font-bold tracking-wider">
                Phase 8 Live
              </Badge>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Domain Specialists & Agent Swarm
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              Autonomous domain specialists collaborating in consensus and sequential pipelines
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[90px]">
              <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                {specialists.length}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Specialists
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[90px]">
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {runs.length}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Swarm Runs
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[90px]">
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                100%
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Governed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'roster' | 'swarm' | 'history')} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <TabsTrigger value="roster" className="gap-2 text-xs font-semibold min-h-[40px] rounded-xl">
            <Users className="w-4 h-4 text-violet-600" />
            <span>Specialist Roster</span>
            <Badge variant="secondary" className="text-[10px] ml-1">
              {specialists.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="swarm" className="gap-2 text-xs font-semibold min-h-[40px] rounded-xl">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Swarm Mission Control</span>
          </TabsTrigger>

          <TabsTrigger value="history" className="gap-2 text-xs font-semibold min-h-[40px] rounded-xl">
            <History className="w-4 h-4 text-slate-500" />
            <span>Swarm Runs</span>
            <Badge variant="secondary" className="text-[10px] ml-1">
              {runs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Specialist Roster */}
        <TabsContent value="roster" className="space-y-6">
          <SpecialistRosterGrid
            specialists={specialists}
            onSelectSpecialist={handleOpenDrawer}
            onQuickDispatch={handleQuickDispatch}
          />
        </TabsContent>

        {/* Tab 2: Swarm Mission Control & Active Synthesis */}
        <TabsContent value="swarm" className="space-y-6">
          <SwarmMissionControl
            workspaceId={workspaceId}
            organizationId={organizationId}
            userId={userId}
            initialSpecialistId={quickDispatchId}
            onMissionCompleted={handleMissionCompleted}
          />

          {activeRun && (
            <SwarmSynthesisCard
              run={activeRun}
              workspaceId={workspaceId}
              userId={userId}
            />
          )}
        </TabsContent>

        {/* Tab 3: Historical Swarm Runs */}
        <TabsContent value="history" className="space-y-6">
          <SwarmRunsHistoryTable
            runs={runs}
            isLoading={isLoading}
            onSelectRun={(run) => {
              setActiveRun(run);
              setActiveTab('swarm');
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Specialist Detail & Policy Drawer */}
      <SpecialistDetailDrawer
        descriptor={selectedSpecialist}
        config={drawerConfig}
        workspaceId={workspaceId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onConfigSaved={(newConfig) => setDrawerConfig(newConfig)}
      />
    </div>
  );
}
