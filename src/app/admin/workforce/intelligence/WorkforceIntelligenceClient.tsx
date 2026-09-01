'use client';

/**
 * @fileOverview Workforce Intelligence & Executive Analytics Client (Phase 11)
 *
 * Executive intelligence deck presenting organizational health, team capacity,
 * role effectiveness, and AI strategic takeaways.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  BrainCircuit,
  Activity,
  Layers,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Users,
  Terminal,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import type { WorkforceIntelligenceSnapshot } from '@/lib/types';
import {
  getWorkforceIntelligenceSnapshotAction,
  refreshWorkforceIntelligenceSnapshotAction,
} from '@/app/actions/workforce-intelligence-actions';

import { ExecutiveOverviewTab } from './components/ExecutiveOverviewTab';
import { UserHealthTab } from './components/UserHealthTab';
import { TeamCapacityTab } from './components/TeamCapacityTab';
import { RoleIntelligenceTab } from './components/RoleIntelligenceTab';
import { AiStrategicInsightsTab } from './components/AiStrategicInsightsTab';

export function WorkforceIntelligenceClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState('overview');
  const [snapshot, setSnapshot] = React.useState<WorkforceIntelligenceSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadSnapshot = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await getWorkforceIntelligenceSnapshotAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success && res.snapshot) {
        setSnapshot(res.snapshot);
      }
    } catch (err: unknown) {
      console.warn('[WorkforceIntelligenceClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleRefresh = async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsRefreshing(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await refreshWorkforceIntelligenceSnapshotAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success && res.snapshot) {
        setSnapshot(res.snapshot);
        toast({
          title: 'Intelligence Snapshot Recalculated',
          description: 'Updated organizational health and team capacity metrics.',
        });
      } else {
        throw new Error(res.error || 'Failed to refresh snapshot');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error refreshing snapshot';
      toast({ title: 'Recalculation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary" /> Workforce Intelligence & Executive Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organizational health index, squad utilization, entitlement density, and AI strategic insights
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/workforce/command-center">
              <Terminal className="h-3.5 w-3.5 mr-1.5 text-primary" /> AI Command Center
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People Hub
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Recalculating...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recalculate Insights
              </>
            )}
          </Button>
        </div>
      </div>

      {snapshot ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/40 p-1 border flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
              <Activity className="w-3.5 h-3.5 text-primary" /> Executive Overview
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
              <Users className="w-3.5 h-3.5 text-primary" /> User Health & Strain
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
              <Layers className="w-3.5 h-3.5 text-primary" /> Team Capacity
            </TabsTrigger>
            <TabsTrigger value="role" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Role Intelligence
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Strategic Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ExecutiveOverviewTab snapshot={snapshot} />
          </TabsContent>

          <TabsContent value="health">
            <UserHealthTab scores={snapshot.userHealthScores} />
          </TabsContent>

          <TabsContent value="team">
            <TeamCapacityTab teams={snapshot.teamSummaries} />
          </TabsContent>

          <TabsContent value="role">
            <RoleIntelligenceTab roles={snapshot.roleSummaries} />
          </TabsContent>

          <TabsContent value="insights">
            <AiStrategicInsightsTab insights={snapshot.strategicInsights} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="p-12 text-center text-xs text-muted-foreground bg-muted/10 border rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Loading organizational intelligence snapshot...
        </div>
      )}
    </div>
  );
}

export default WorkforceIntelligenceClient;
