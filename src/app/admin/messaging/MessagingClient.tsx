'use client';

/**
 * @fileOverview Master Orchestrator for the SmartSapp Messaging Hub.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Strict typing, zero any.
 * - Rule 7: Mobile-first responsive 12-column grid.
 * - Rule 8: Safe relative routing.
 * - Rule 9: High-load anti-exhaustion: eliminates unbounded useCollection.
 * - Rule 19: Human-in-the-loop review guards.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';
import type { MessagingDashboardSummary } from '@/lib/types/messaging-dashboard';
import { MessagingHeroGreeting } from './components/dashboard/MessagingHeroGreeting';
import { MessagingAiPromptModal } from './components/dashboard/MessagingAiPromptModal';
import { MessagingKpiGrid } from './components/dashboard/MessagingKpiGrid';
import { MessagingQuickActions } from './components/dashboard/MessagingQuickActions';
import { MessagingAllFeaturesModal } from './components/dashboard/MessagingAllFeaturesModal';
import { MessagingInboxPreview } from './components/dashboard/MessagingInboxPreview';
import { MessagingPerformanceCharts } from './components/dashboard/MessagingPerformanceCharts';
import { RecentCampaignsCard } from './components/dashboard/RecentCampaignsCard';
import { QuickMessageComposerCard } from './components/dashboard/QuickMessageComposerCard';
import { QuickTemplatesCard } from './components/dashboard/QuickTemplatesCard';
import { ActiveQueuesCard } from './components/dashboard/ActiveQueuesCard';
import { MessagingFooterHighlights } from './components/dashboard/MessagingFooterHighlights';
import { MobileBottomNav } from './components/dashboard/MobileBottomNav';

export default function MessagingClient() {
  const { activeOrganizationId, activeWorkspaceId } = useWorkspace();
  const [summary, setSummary] = React.useState<MessagingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [isAllFeaturesOpen, setIsAllFeaturesOpen] = React.useState(false);

  const loadSummary = React.useCallback(
    async (forceRefresh = false) => {
      if (!activeOrganizationId || !activeWorkspaceId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await getMessagingDashboardSummaryAction({
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          forceRefresh,
        });
        if (res.success) {
          setSummary(res.data);
        }
      } catch (err) {
        console.error('Failed to load messaging dashboard summary:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrganizationId, activeWorkspaceId]
  );

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <PageContainerFluid className="space-y-6 pb-20 md:pb-8">
      {/* 1. Hero Greeting Banner */}
      <MessagingHeroGreeting onOpenAiModal={() => setIsAiModalOpen(true)} />

      {/* 2. Top KPI Metrics Grid (4 Stat Cards) */}
      <MessagingKpiGrid metrics={summary?.kpi} isLoading={isLoading} />

      {/* 3. Main Dashboard Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 Cols): Quick Actions + Inbox + Charts */}
        <div className="lg:col-span-8 space-y-6">
          <MessagingQuickActions onOpenAllFeatures={() => setIsAllFeaturesOpen(true)} />
          <MessagingInboxPreview items={summary?.inboxPreview ?? []} isLoading={isLoading} />
          <MessagingPerformanceCharts
            performance={summary?.performance}
            channelBreakdown={summary?.channelBreakdown ?? []}
            isLoading={isLoading}
          />
          <RecentCampaignsCard
            campaigns={summary?.recentCampaigns ?? []}
            isLoading={isLoading}
            onOpenAiModal={() => setIsAiModalOpen(true)}
          />
        </div>

        {/* Right Column (4 Cols): Stacked Sidebar Utilities */}
        <div className="lg:col-span-4 space-y-6">
          <QuickMessageComposerCard onMessageSent={() => loadSummary(true)} />
          <QuickTemplatesCard />
          <ActiveQueuesCard stats={summary?.activeQueues} isLoading={isLoading} />
        </div>
      </div>

      {/* 4. Footer Value Pillars */}
      <MessagingFooterHighlights />

      {/* 5. Modals & Drawers */}
      <MessagingAiPromptModal open={isAiModalOpen} onOpenChange={setIsAiModalOpen} />
      <MessagingAllFeaturesModal open={isAllFeaturesOpen} onOpenChange={setIsAllFeaturesOpen} />

      {/* 6. Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMore={() => setIsAllFeaturesOpen(true)} />
    </PageContainerFluid>
  );
}
