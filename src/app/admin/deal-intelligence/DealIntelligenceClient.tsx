'use client';

/**
 * @fileoverview Deal & Buyer Intelligence Cockpit Host Client (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Sections 44, 53 & UI Specifications Sections 23-28, 3127-3156:
 * 1. High-density KPI cards (Active Signals, At-Risk Pipeline, Meeting Briefs, Average Deal Health).
 * 2. 4-Tab Navigation:
 *    - Buyer Signal Center
 *    - Deal Health & Risk Matrix
 *    - Stakeholder Map & Power Matrix
 *    - Meeting Intelligence Studio
 * 3. Deep cross-linking between deal health and stakeholder power matrix.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Uses useTenant() and useWorkspace() context safely.
 * - Mobile accessibility: touch targets maintain >= 44px with active:scale-[0.97].
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Compass,
  Zap,
  Activity,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { DealIntelligenceOverview } from '@/lib/deal-intelligence/types';
import { getDealIntelligenceOverviewAction } from '@/app/actions/deal-intelligence-actions';
import { BuyerSignalCenterTab } from './components/BuyerSignalCenterTab';
import { DealHealthTab } from './components/DealHealthTab';
import { StakeholderMapTab } from './components/StakeholderMapTab';
import { MeetingBriefTab } from './components/MeetingBriefTab';

export default function DealIntelligenceClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const currentUserId = user?.uid || 'usr_rep_1';
  const currentUserName = user?.displayName || 'Sales Representative';

  // State
  const [activeTab, setActiveTab] = React.useState<string>('signals');
  const [selectedDealId, setSelectedDealId] = React.useState<string | undefined>(undefined);
  const [overview, setOverview] = React.useState<DealIntelligenceOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Data Loading
  const loadData = React.useCallback(async () => {
    try {
      const res = await getDealIntelligenceOverviewAction({
        workspaceId,
        organizationId,
        userId: currentUserId,
        userName: currentUserName,
      });

      if (res.success && res.overview) {
        setOverview(res.overview);
      } else if (res.error) {
        toast({
          title: 'Intelligence Sync Notice',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to communicate with intelligence service.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, currentUserName, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    toast({ title: 'Intelligence Refreshed', description: 'Real-time buyer signals and health scores updated.' });
  };

  const handleNavigateToDealStakeholders = (dealId: string) => {
    setSelectedDealId(dealId);
    setActiveTab('stakeholders');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">
          Loading Buyer & Deal Intelligence...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Cockpit Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Buyer & Deal Intelligence
              </h1>
              <p className="text-xs text-muted-foreground">
                Understand deal risk, capture real-time buyer intent signals, map buying committees, and streamline meeting briefings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Intelligence
          </Button>
        </div>
      </div>

      {/* Macro KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Signals */}
        <Card className="p-4 space-y-2 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active Buyer Signals
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-foreground">
              {overview?.activeSignalsCount || 0}
            </span>
            <Badge className="bg-rose-500/15 text-rose-600 border-none text-[11px] font-semibold">
              {overview?.highIntentSignalsCount || 0} High Intent
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Real-time intent spikes and proposal views
          </p>
        </Card>

        {/* Card 2: At-Risk Pipeline */}
        <Card className="p-4 space-y-2 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              At-Risk Pipeline
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              ${((overview?.atRiskPipelineValue || 0) / 1000).toFixed(0)}k
            </span>
            <Badge variant="outline" className="text-[11px] font-mono">
              {overview?.atRiskDealsCount || 0} Deals
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Opportunities with stalled cadence or single-thread risk
          </p>
        </Card>

        {/* Card 3: Upcoming Briefs */}
        <Card className="p-4 space-y-2 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Meeting Briefs Ready
            </span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-foreground">
              {overview?.upcomingBriefsCount || 0}
            </span>
            <Badge className="bg-blue-500/15 text-blue-600 border-none text-[11px] font-semibold">
              Prepped
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dossiers with past objections and talk tracks
          </p>
        </Card>

        {/* Card 4: Average Deal Health */}
        <Card className="p-4 space-y-2 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pipeline Health Index
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {overview?.averageDealHealth || 75}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
            </span>
            <Badge className="bg-emerald-500/15 text-emerald-600 border-none text-[11px] font-semibold">
              {overview?.healthDistribution.healthy || 0} Healthy
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Weighted across recency, stakeholders, velocity, sentiment
          </p>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/60 min-h-[48px]">
          <TabsTrigger
            value="signals"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" />
            Buyer Signals ({overview?.activeSignalsCount || 0})
          </TabsTrigger>
          <TabsTrigger
            value="health"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Activity className="w-3.5 h-3.5 mr-2 text-primary" />
            Deal Health & Risk
          </TabsTrigger>
          <TabsTrigger
            value="stakeholders"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="w-3.5 h-3.5 mr-2 text-purple-500" />
            Stakeholder Map
          </TabsTrigger>
          <TabsTrigger
            value="meetings"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 mr-2 text-blue-500" />
            Meeting Studio
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Buyer Signal Center */}
        <TabsContent value="signals">
          <BuyerSignalCenterTab
            signals={overview?.recentSignals || []}
            workspaceId={workspaceId}
            organizationId={organizationId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onRefreshSignals={loadData}
          />
        </TabsContent>

        {/* Tab 2: Deal Health & Risk Matrix */}
        <TabsContent value="health">
          <DealHealthTab
            scorecards={overview?.atRiskDeals || []}
            onSelectDeal={handleNavigateToDealStakeholders}
          />
        </TabsContent>

        {/* Tab 3: Stakeholder Map & Power Matrix */}
        <TabsContent value="stakeholders">
          <StakeholderMapTab
            scorecards={overview?.atRiskDeals || []}
            selectedDealId={selectedDealId}
            workspaceId={workspaceId}
            organizationId={organizationId}
            currentUserId={currentUserId}
            onRefreshData={loadData}
          />
        </TabsContent>

        {/* Tab 4: Meeting Intelligence Studio */}
        <TabsContent value="meetings">
          <MeetingBriefTab
            briefs={overview?.upcomingBriefs || []}
            workspaceId={workspaceId}
            organizationId={organizationId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onRefreshData={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
