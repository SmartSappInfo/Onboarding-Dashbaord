'use client';

/**
 * @fileOverview CRM-Aware Workforce Allocation Control Center (Phase 7)
 *
 * Administrative control plane for CRM entity distribution, rep workload balancing,
 * and portfolio ownership migration.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Briefcase,
  DollarSign,
  Users,
  ArrowRightLeft,
  RefreshCw,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { CrmWorkloadSummary, PersonDetailView } from '@/lib/types';
import { getOrganizationCrmWorkloadOverviewAction } from '@/app/actions/crm-workforce-actions';
import { getPeopleDirectoryAction } from '@/app/actions/identity-actions';

import { CrmWorkloadOverviewTable } from './components/CrmWorkloadOverviewTable';
import { OwnershipTransferModal } from './components/OwnershipTransferModal';

export function WorkforceCrmClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [workloads, setWorkloads] = React.useState<CrmWorkloadSummary[]>([]);
  const [people, setPeople] = React.useState<PersonDetailView[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedTransferWorkload, setSelectedTransferWorkload] = React.useState<CrmWorkloadSummary | null>(null);

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [wlRes, peopleRes] = await Promise.all([
        getOrganizationCrmWorkloadOverviewAction({ idToken, organizationId: activeOrganizationId }),
        getPeopleDirectoryAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (wlRes.success) setWorkloads(wlRes.workloads);
      if (peopleRes.success) setPeople(peopleRes.people);
    } catch (err: unknown) {
      console.warn('[WorkforceCrmClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate Metrics
  const totalPipeline = workloads.reduce((acc, w) => acc + w.totalPipelineValue, 0);
  const totalDeals = workloads.reduce((acc, w) => acc + w.dealCount, 0);
  const totalContacts = workloads.reduce((acc, w) => acc + w.contactCount, 0);
  const totalTasks = workloads.reduce((acc, w) => acc + w.openTaskCount, 0);

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> CRM-Aware Workforce Allocation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Representative portfolio distribution, pipeline capacity, and deterministic ownership transfers
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
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
            className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh Assets
          </Button>
        </div>
      </div>

      {/* Top 4 Metric Ribbon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Total Active Pipeline</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">${totalPipeline.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground">{totalDeals} deals in flight</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Managed Contacts & Leads</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{totalContacts}</div>
            <p className="text-[11px] text-muted-foreground">Assigned to team representatives</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Pending Operational Tasks</CardTitle>
            <Zap className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{totalTasks}</div>
            <p className="text-[11px] text-muted-foreground">Unresolved follow-up tasks</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Sales Reps</CardTitle>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{workloads.length}</div>
            <p className="text-[11px] text-emerald-600 font-semibold">100% capacity tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Workload Overview Table */}
      <CrmWorkloadOverviewTable
        workloads={workloads}
        isLoading={isLoading}
        onSelectTransfer={setSelectedTransferWorkload}
      />

      {/* Ownership Transfer Modal */}
      <OwnershipTransferModal
        isOpen={Boolean(selectedTransferWorkload)}
        onClose={() => setSelectedTransferWorkload(null)}
        sourceWorkload={selectedTransferWorkload}
        people={people}
        onTransferred={loadData}
      />
    </div>
  );
}

export default WorkforceCrmClient;
