'use client';

/**
 * @fileOverview People & Workforce Analytics Control Center (Analytics 2.0)
 *
 * Unified analytics console for DAU/MAU adoption trends, squad performance leaderboards,
 * least-privilege permission usage heatmaps, and live platform telemetry.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Tabs with Emil Kowalski spring easing.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  TrendingUp,
  Users2,
  ShieldAlert,
  Activity,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type {
  OrganizationAdoptionSummary,
  MemberActivityMetric,
} from '@/lib/types';
import {
  getWorkforceAdoptionMetricsAction,
  getTeamLeaderboardAction,
  getLeastPrivilegeReportAction,
} from '@/app/actions/analytics-actions';

import { AdoptionMetricsOverview } from './components/AdoptionMetricsOverview';
import { TeamActivityLeaderboard } from './components/TeamActivityLeaderboard';
import { LeastPrivilegeHeatmap } from './components/LeastPrivilegeHeatmap';
import { LiveActivityStream } from './components/LiveActivityStream';

interface LeastPrivilegeRoleReport {
  roleId: string;
  roleName: string;
  totalPermissions: number;
  usedPermissions: number;
  dormantPermissions: number;
  utilizationRate: number;
  records: Array<{
    id: string;
    organizationId: string;
    roleId: string;
    roleName: string;
    permissionId: string;
    actionCount90d: number;
    lastUsedAt?: string;
    isDormant: boolean;
  }>;
}

export function PeopleAnalyticsClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'adoption' | 'teams' | 'privilege' | 'stream'>('adoption');

  // State
  const [summary, setSummary] = React.useState<OrganizationAdoptionSummary | null>(null);
  const [memberMetrics, setMemberMetrics] = React.useState<MemberActivityMetric[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<
    Array<{
      teamId: string;
      teamName: string;
      memberCount: number;
      activeMemberCount: number;
      activePercent: number;
      weeklyEventVolume: number;
    }>
  >([]);
  const [rolesReport, setRolesReport] = React.useState<LeastPrivilegeRoleReport[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [adoptRes, leadRes, privRes] = await Promise.all([
        getWorkforceAdoptionMetricsAction({ idToken, organizationId: activeOrganizationId }),
        getTeamLeaderboardAction({ idToken, organizationId: activeOrganizationId }),
        getLeastPrivilegeReportAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (adoptRes.success && adoptRes.summary) {
        setSummary(adoptRes.summary);
        setMemberMetrics(adoptRes.memberMetrics);
      }
      if (leadRes.success) {
        setLeaderboard(leadRes.leaderboard);
      }
      if (privRes.success) {
        setRolesReport(privRes.roles);
      }
    } catch (err: unknown) {
      console.warn('[PeopleAnalyticsClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> People & Workforce Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adoption metrics, squad collaboration velocity, least-privilege telemetry, and real-time activity stream
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People Hub
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Tabs Control */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'adoption' | 'teams' | 'privilege' | 'stream')}>
        <TabsList className="h-10 bg-muted/60 border border-border/60 p-1 rounded-xl gap-1">
          <TabsTrigger
            value="adoption"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Adoption & Engagement
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Users2 className="w-3.5 h-3.5 mr-1.5" /> Team Leaderboard ({leaderboard.length})
          </TabsTrigger>
          <TabsTrigger
            value="privilege"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Least-Privilege Heatmap
          </TabsTrigger>
          <TabsTrigger
            value="stream"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Live Activity Stream
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Adoption */}
        <TabsContent value="adoption" className="pt-2 m-0">
          <AdoptionMetricsOverview
            summary={summary}
            memberMetrics={memberMetrics}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2: Teams */}
        <TabsContent value="teams" className="pt-2 m-0">
          <TeamActivityLeaderboard
            leaderboard={leaderboard}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: Least Privilege */}
        <TabsContent value="privilege" className="pt-2 m-0">
          <LeastPrivilegeHeatmap
            rolesReport={rolesReport}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 4: Live Activity Stream */}
        <TabsContent value="stream" className="pt-2 m-0">
          <LiveActivityStream />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PeopleAnalyticsClient;
