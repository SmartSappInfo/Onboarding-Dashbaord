'use client';

/**
 * @fileOverview CRM-Aware Workforce Allocation Control Center (Phase 7)
 *
 * Administrative control plane for CRM entity distribution, rep workload balancing,
 * and portfolio ownership migration strictly scoped to the active workspace.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Scoped to `activeWorkspaceId` from `useTenant()` to ensure representative
 *   asset allocation reflects only entities and activities within the current workspace.
 * - Dynamic currency formatting based on active workspace settings.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing standard.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useTenant } from '@/context/TenantContext';
import {
  Briefcase,
  DollarSign,
  Users,
  RefreshCw,
  Zap,
  CalendarRange,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { CrmWorkloadSummary, PersonDetailView, Deal } from '@/lib/types';
import { getOrganizationCrmWorkloadOverviewAction } from '@/app/actions/crm-workforce-actions';
import { getPeopleDirectoryAction } from '@/app/actions/identity-actions';

import { CrmWorkloadOverviewTable } from './components/CrmWorkloadOverviewTable';
import { OwnershipTransferModal } from './components/OwnershipTransferModal';
import { DealTaskCadenceModal } from '@/app/admin/pipeline/components/DealTaskCadenceModal';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

export function WorkforceCrmClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace } = useTenant();

  const [workloads, setWorkloads] = React.useState<CrmWorkloadSummary[]>([]);
  const [people, setPeople] = React.useState<PersonDetailView[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedTransferWorkload, setSelectedTransferWorkload] = React.useState<CrmWorkloadSummary | null>(null);

  // Phase 5: Deal Task Cadence & Cleanup State
  const firestore = useFirestore();
  const [isCadenceModalOpen, setIsCadenceModalOpen] = React.useState(false);

  // Query active workspace deals to detect unassigned deals and missing next-step tasks
  const dealsQuery = useMemoFirebase(
    () => {
      if (!firestore || !activeWorkspaceId) return null;
      return query(
        collection(firestore, 'deals'),
        where('workspaceId', '==', activeWorkspaceId),
        where('status', '==', 'open')
      );
    },
    [firestore, activeWorkspaceId]
  );
  const { data: deals } = useCollection<Deal>(dealsQuery);

  const unassignedOrNoTaskDeals = React.useMemo(() => {
    if (!deals) return [];
    return deals.filter(d => {
      if (d.isArchived) return false;
      const assigned = d.assignedTo;
      const isUnassigned =
        !assigned ||
        (typeof assigned === 'object' && !assigned.userId);
      const hasNoTask = typeof d.nextStep === 'string'
        ? d.nextStep.trim().length === 0
        : !d.nextStep || Boolean(d.nextStep.isCompleted) || !d.nextStep.title;
      return isUnassigned || hasNoTask;
    });
  }, [deals]);

  const currency = activeWorkspace?.currency || 'USD';

  const formatCurrency = React.useCallback(
    (val: number) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(val);
      } catch {
        return `$${val.toLocaleString()}`;
      }
    },
    [currency]
  );

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [wlRes, peopleRes] = await Promise.all([
        getOrganizationCrmWorkloadOverviewAction({
          idToken,
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId || undefined,
        }),
        getPeopleDirectoryAction({
          idToken,
          organizationId: activeOrganizationId,
          filter: activeWorkspaceId ? { workspaceId: activeWorkspaceId } : undefined,
        }),
      ]);

      if (wlRes.success) setWorkloads(wlRes.workloads);
      if (peopleRes.success) setPeople(peopleRes.people);
    } catch (err: unknown) {
      console.warn('[WorkforceCrmClient] Load error:', err);
      toast({
        title: 'Failed to load workspace assets',
        description: 'Could not retrieve workforce allocation data for the current workspace.',
        variant: 'destructive',
        actionConfig: {
          path: '/admin/workforce/crm',
          label: 'Retry',
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId, activeWorkspaceId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate Metrics
  const totalPipeline = workloads.reduce((acc, w) => acc + w.totalPipelineValue, 0);
  const totalDeals = workloads.reduce((acc, w) => acc + w.dealCount, 0);
  const totalContacts = workloads.reduce((acc, w) => acc + w.contactCount, 0);
  const totalTasks = workloads.reduce((acc, w) => acc + w.openTaskCount, 0);

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto font-figtree">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                CRM-Aware Workforce Allocation
              </h1>
              <CardInfoTooltip text="Representative portfolio distribution, pipeline capacity, and deterministic ownership transfers scoped to this workspace." />
            </div>
            {activeWorkspace?.name && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-medium">Workspace:</span>
                <Badge variant="outline" className="text-[11px] font-semibold bg-primary/5 text-primary border-primary/20">
                  {activeWorkspace.name}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {unassignedOrNoTaskDeals.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCadenceModalOpen(true)}
              className="rounded-xl h-9 px-3.5 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.97] transition-all"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Clean Up Cadence ({unassignedOrNoTaskDeals.length})</span>
            </Button>
          )}

          <Button asChild variant="outline" size="sm" className="rounded-xl h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People Directory
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="rounded-xl h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Assets
          </Button>
        </div>
      </div>

      {/* Top 4 Metric Ribbon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Total Active Pipeline</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{formatCurrency(totalPipeline)}</div>
            <p className="text-[11px] text-muted-foreground">{totalDeals} deals in flight</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Managed Contacts & Leads</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{totalContacts}</div>
            <p className="text-[11px] text-muted-foreground">Assigned to team representatives</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Pending Operational Tasks</CardTitle>
            <Zap className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{totalTasks}</div>
            <p className="text-[11px] text-muted-foreground">Unresolved follow-up tasks</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Sales Reps</CardTitle>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{workloads.length}</div>
            <p className="text-[11px] text-emerald-600 font-semibold">
              {activeWorkspace?.name ? `${activeWorkspace.name} capacity` : '100% capacity tracked'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned / Lacking Next Steps Cadence Banner */}
      {unassignedOrNoTaskDeals.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  Deal Cadence Action Required
                </span>
                <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold px-2 py-0.5 border-amber-500/30">
                  {unassignedOrNoTaskDeals.length} Opportunities
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unassignedOrNoTaskDeals.length} deals in this workspace are unassigned or lack scheduled follow-up steps. Run the Cadence Engine to assign representatives and pace daily outreach.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCadenceModalOpen(true)}
            className="rounded-xl h-9 px-4 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.97] shrink-0"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            <span>Launch Cadence Wizard</span>
          </Button>
        </div>
      )}

      {/* Main Workload Overview Table */}
      <CrmWorkloadOverviewTable
        workloads={workloads}
        isLoading={isLoading}
        currency={currency}
        onSelectTransfer={setSelectedTransferWorkload}
      />

      {/* Ownership Transfer Modal */}
      <OwnershipTransferModal
        isOpen={Boolean(selectedTransferWorkload)}
        onClose={() => setSelectedTransferWorkload(null)}
        sourceWorkload={selectedTransferWorkload}
        people={people}
        workspaceId={activeWorkspaceId || undefined}
        currency={currency}
        onTransferred={loadData}
      />

      {/* Deal Task Cadence & Cleanup Wizard Modal */}
      <DealTaskCadenceModal
        open={isCadenceModalOpen}
        onOpenChange={setIsCadenceModalOpen}
        deals={unassignedOrNoTaskDeals}
        workspaceId={activeWorkspaceId || ''}
        organizationId={activeOrganizationId || ''}
        currency={currency}
        onCompleted={() => {
          setIsCadenceModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
}

export default WorkforceCrmClient;
