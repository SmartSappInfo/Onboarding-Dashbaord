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
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Layers,
  Users,
  BarChart3,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { OnboardingJourney, OnboardingInstance } from '@/lib/types';
import {
  listJourneysAction,
  listOnboardingInstancesAction,
  seedDefaultJourneysAction,
} from '@/app/actions/onboarding-actions';
import { JourneyLibraryList } from './components/JourneyLibraryList';
import { JourneyBuilderModal } from './components/JourneyBuilderModal';
import { ActiveOnboardingTable } from './components/ActiveOnboardingTable';

export function OnboardingClient() {
  const { toast } = useToast();
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Onboarding Journey Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure dynamic multi-step onboarding paths, adaptive rules, and monitor member progression
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People & Workforce Hub
            </Link>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            className="rounded-lg font-semibold h-9 px-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97] text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Journey Blueprint
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'library' | 'active' | 'analytics')}>
        <TabsList className="h-10 bg-card border p-1 rounded-xl">
          <TabsTrigger value="library" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Journey Library ({journeys.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Active Onboarding Queue ({instances.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics & SLAs
          </TabsTrigger>
        </TabsList>

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
