'use client';

/**
 * @fileOverview Onboarding Hub Administration Center (Onboarding 2.0)
 *
 * Comprehensive administrative management of onboarding journeys,
 * active member queues, SLA turnarounds, and adaptive step configuration.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Tabs with Emil Kowalski transition easing.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Layers,
  Users,
  BarChart3,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import type { OnboardingJourney, OnboardingInstance } from '@/lib/types';
import {
  listJourneysAction,
  listOnboardingInstancesAction,
} from '@/app/actions/onboarding-actions';
import { JourneyLibraryList } from './components/JourneyLibraryList';
import { JourneyBuilderModal } from './components/JourneyBuilderModal';
import { ActiveOnboardingTable } from './components/ActiveOnboardingTable';

export function OnboardingClient() {
  const { toast: _toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'library' | 'active' | 'analytics'>('library');
  const [journeys, setJourneys] = React.useState<OnboardingJourney[]>([]);
  const [instances, setInstances] = React.useState<OnboardingInstance[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Modal State
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [editingJourney, setEditingJourney] = React.useState<OnboardingJourney | null>(null);

  // Load Data
  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [journeysRes, instancesRes] = await Promise.all([
        listJourneysAction({ idToken, organizationId: activeOrganizationId }),
        listOnboardingInstancesAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (journeysRes.success) setJourneys(journeysRes.journeys);
      if (instancesRes.success) setInstances(instancesRes.instances);
    } catch (err: unknown) {
      console.warn('[OnboardingClient] Failed to load onboarding data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditJourney = (j: OnboardingJourney) => {
    setEditingJourney(j);
    setBuilderOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingJourney(null);
    setBuilderOpen(true);
  };

  // Analytics Computations
  const completedInstances = instances.filter((i) => i.status === 'completed');
  const inProgressInstances = instances.filter((i) => i.status === 'in_progress');
  const avgCompletion =
    instances.length > 0
      ? Math.round(instances.reduce((sum, i) => sum + i.completionPercent, 0) / instances.length)
      : 0;

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Main Tabs Wrapper */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'library' | 'active' | 'analytics')} className="space-y-6">
        {/* Top Header Bar: Page Name on Top-Left, Segmented Tabs on Top-Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Onboarding Journey Engine
              </h1>
              <CardInfoTooltip text="Configure dynamic multi-step onboarding paths, adaptive rules, and monitor member progression." />
            </div>
          </div>

          {/* Top-Right Segmented Tabs */}
          <TabsList className="inline-flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto self-start sm:self-auto">
            <TabsTrigger
              value="library"
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <Layers className="w-3.5 h-3.5" /> Blueprints ({journeys.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <Users className="w-3.5 h-3.5" /> Active Queue ({instances.length})
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-end gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-xl h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People & Workforce Hub
            </Link>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            className="rounded-xl font-semibold h-9 px-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97] text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Journey Blueprint
          </Button>
        </div>

        {/* Tab 1: Journey Library */}
        <TabsContent value="library" className="pt-2 m-0">
          <JourneyLibraryList
            journeys={journeys}
            onEditJourney={handleEditJourney}
            onRefresh={loadData}
            onOpenCreateModal={handleOpenCreate}
          />
        </TabsContent>

        {/* Tab 2: Active Onboarding Table */}
        <TabsContent value="active" className="pt-2 m-0">
          <ActiveOnboardingTable
            instances={instances}
            isLoading={isLoading}
            onRefresh={loadData}
          />
        </TabsContent>

        {/* Tab 3: Analytics & SLAs */}
        <TabsContent value="analytics" className="space-y-4 pt-2 m-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border bg-card shadow-xs">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground block">Active In-Progress</span>
                <span className="text-2xl font-black text-blue-600">{inProgressInstances.length}</span>
                <p className="text-[11px] text-muted-foreground">Members currently completing induction steps</p>
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-xs">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground block">Completed & Certified</span>
                <span className="text-2xl font-black text-emerald-600">{completedInstances.length}</span>
                <p className="text-[11px] text-muted-foreground">Fully activated organization members</p>
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-xs">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground block">Average Journey Progress</span>
                <span className="text-2xl font-black text-foreground">{avgCompletion}%</span>
                <p className="text-[11px] text-muted-foreground">Across all active member onboarding paths</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Visual Journey Builder Modal */}
      <JourneyBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        editingJourney={editingJourney}
        onSaved={loadData}
      />
    </div>
  );
}

export default OnboardingClient;
