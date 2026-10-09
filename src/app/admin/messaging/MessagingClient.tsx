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
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';
import type {
  MessagingDashboardSummary,
  MessagingDashboardTimeRange,
  MessagingDashboardChannel,
} from '@/lib/types/messaging-dashboard';
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
import { MobileBottomNav } from './components/dashboard/MobileBottomNav';

export default function MessagingClient() {
  const { activeOrganizationId, activeWorkspaceId, isLoading: isTenantLoading } = useWorkspace();
  const [summary, setSummary] = React.useState<MessagingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [isAllFeaturesOpen, setIsAllFeaturesOpen] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<{
    snippet: string;
    subject?: string;
    defaultChannel?: MessagingDashboardChannel;
  } | null>(null);
  const [timeRange, setTimeRange] = React.useState<MessagingDashboardTimeRange>('7d');

  const loadSummary = React.useCallback(
    async (forceRefresh = false, range: MessagingDashboardTimeRange = timeRange) => {
      // If tenant context is still initializing, don't set loading to false prematurely
      if (isTenantLoading) {
        return;
      }
      if (!activeOrganizationId || !activeWorkspaceId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await getMessagingDashboardSummaryAction({
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          timeRange: range,
          forceRefresh,
        });
        if (res.success) {
          setSummary(res.data);
          setErrorMessage(null);
        } else {
          console.error('[MessagingClient] Failed to load dashboard summary:', res.error);
          setErrorMessage(res.error || 'Failed to load messaging statistics.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load messaging statistics.';
        console.error('[MessagingClient] Exception loading messaging dashboard summary:', err);
        setErrorMessage(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrganizationId, activeWorkspaceId, isTenantLoading, timeRange]
  );

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <PageContainerFluid className="space-y-6 pb-20 md:pb-8">
      {/* 1. Hero Greeting Banner */}
      <MessagingHeroGreeting
        onOpenAiPrompt={() => setIsAiModalOpen(true)}
        promptStarters={summary?.settings?.aiPromptStarters}
      />

      {/* Actionable Error State with Retry Button */}
      {errorMessage && !summary && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">Unable to load messaging statistics</p>
              <p className="text-xs text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSummary(true)}
            className="self-start sm:self-center border-border/80 hover:bg-background/80 active:scale-[0.97] min-h-[44px] sm:min-h-[36px] rounded-xl text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* 2. Top KPI Metrics Grid (4 Stat Cards) */}
      <MessagingKpiGrid
        metrics={summary?.kpi}
        isLoading={isLoading}
        lowBalanceThreshold={summary?.settings?.lowBalanceThreshold}
      />

      {/* 3. Main Dashboard Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 Cols): Quick Actions + Inbox + Charts */}
        <div className="lg:col-span-8 space-y-6">
          <MessagingQuickActions onOpenAllFeatures={() => setIsAllFeaturesOpen(true)} />
          <MessagingInboxPreview
            items={summary?.inboxPreview ?? []}
            isLoading={isLoading}
            onOpenAiAssistant={() => setIsAiModalOpen(true)}
          />
          <MessagingPerformanceCharts
            performance={summary?.performance}
            channelBreakdown={summary?.channelBreakdown ?? []}
            activeTimeRange={timeRange}
            onTimeRangeChange={(r) => {
              setTimeRange(r);
              loadSummary(false, r);
            }}
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
          <QuickMessageComposerCard
            initialMessage={selectedTemplate?.snippet}
            initialSubject={selectedTemplate?.subject}
            initialChannel={selectedTemplate?.defaultChannel}
            workspaceId={activeWorkspaceId ?? undefined}
            smsBalance={summary?.kpi.smsBalance}
            killSwitches={summary?.settings?.channelKillSwitches}
            onMessageSent={() => loadSummary(true)}
          />
          <QuickTemplatesCard
            allowedTemplateIds={summary?.settings?.quickTemplateIds}
            onSelectTemplate={(tpl) =>
              setSelectedTemplate({
                snippet: tpl.snippet,
                subject: tpl.subject,
                defaultChannel: tpl.defaultChannel,
              })
            }
          />
          <ActiveQueuesCard stats={summary?.activeQueues} isLoading={isLoading} />
        </div>
      </div>

      {/* 5. Modals & Drawers */}
      <MessagingAiPromptModal
        isOpen={isAiModalOpen}
        onOpenChange={setIsAiModalOpen}
        customStarters={summary?.settings?.aiPromptStarters}
      />
      <MessagingAllFeaturesModal open={isAllFeaturesOpen} onOpenChange={setIsAllFeaturesOpen} />

      {/* 6. Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMore={() => setIsAllFeaturesOpen(true)} />
    </PageContainerFluid>
  );
}
