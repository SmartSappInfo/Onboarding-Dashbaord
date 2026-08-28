/**
 * @fileoverview Platform Control Plane Tenant Health Dashboard Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Aggregates cross-tenant health metrics, anomalies, and support triage.
 * - Adheres to Emil Kowalski animation principles and responsive design.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  HeartPulse,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Search,
  RefreshCw,
  Loader2,
  ListFilter,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import { getTenantHealthOverviewAction } from '@/lib/backoffice/backoffice-health-actions';
import type { TenantHealthScore } from '@/lib/backoffice/backoffice-types';
import TenantHealthCard from './TenantHealthCard';
import IssueTriage from './IssueTriage';
import ImpersonationLaunchModal from './ImpersonationLaunchModal';

export default function HealthDashboardClient() {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'scorecards' | 'issues'>('scorecards');
  const [scorecards, setScorecards] = React.useState<TenantHealthScore[]>([]);
  const [summary, setSummary] = React.useState<{
    totalTenants: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    avgHealthScore: number;
  }>({
    totalTenants: 0,
    healthyCount: 0,
    warningCount: 0,
    criticalCount: 0,
    avgHealthScore: 100,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
  const [impersonationOrgId, setImpersonationOrgId] = React.useState<string | null>(null);
  const [isImpersonationOpen, setIsImpersonationOpen] = React.useState(false);

  const fetchHealthData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getTenantHealthOverviewAction(idToken);

      if (res.success && res.scorecards && res.summary) {
        setScorecards(res.scorecards);
        setSummary(res.summary);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load telemetry',
          description: res.error || 'Unknown error occurred.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch tenant health overview.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const handleLaunchImpersonation = (orgId: string) => {
    setImpersonationOrgId(orgId);
    setIsImpersonationOpen(true);
  };

  const filteredScorecards = React.useMemo(() => {
    return scorecards.filter((s) => {
      const matchesSearch =
        search === '' ||
        s.organizationName.toLowerCase().includes(search.toLowerCase()) ||
        s.organizationId.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scorecards, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HeartPulse className="h-6 w-6 text-emerald-500" />
            Tenant Health & Issue Triage Hub
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time multi-tenant health signals, anomaly telemetry, and support triage operations.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealthData}
          disabled={isLoading}
          className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan Telemetry'}
        </Button>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Platform Health Avg</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{summary.avgHealthScore}%</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">composite</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Healthy Tenants</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{summary.healthyCount}</span>
            <span className="text-[11px] text-muted-foreground">/ {summary.totalTenants} orgs</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Warning Condition</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{summary.warningCount}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">needs check</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Critical Anomalies</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{summary.criticalCount}</span>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">immediate action</span>
          </div>
        </Card>
      </div>

      {/* Main View Mode Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          onClick={() => setActiveTab('scorecards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
            activeTab === 'scorecards'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Tenant Scorecards</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-muted">
            {summary.totalTenants}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('issues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
            activeTab === 'issues'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Anomaly Issue Triage</span>
          {summary.warningCount + summary.criticalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
              {summary.warningCount + summary.criticalCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Tenant Scorecards View */}
      {activeTab === 'scorecards' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenant scorecards by organization name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'healthy' | 'warning' | 'critical')}
            >
              <SelectTrigger className="h-11 w-full sm:w-[150px] rounded-xl bg-card border-border text-xs font-semibold">
                <SelectValue placeholder="Health Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="warning">Attention</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs font-medium">Scanning tenant telemetry signals...</p>
            </div>
          ) : filteredScorecards.length === 0 ? (
            <div className="p-16 rounded-2xl border border-border bg-card text-center space-y-2">
              <p className="text-sm font-bold text-foreground">No tenant scorecards match filter</p>
              <p className="text-xs text-muted-foreground">Adjust your search parameters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScorecards.map((scorecard) => (
                <TenantHealthCard
                  key={scorecard.organizationId}
                  scorecard={scorecard}
                  onLaunchImpersonation={can('health', 'execute') ? handleLaunchImpersonation : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Anomaly Issue Triage View */}
      {activeTab === 'issues' && <IssueTriage />}

      {/* Impersonation Launch Modal */}
      <ImpersonationLaunchModal
        organizationId={impersonationOrgId}
        open={isImpersonationOpen}
        onOpenChange={setIsImpersonationOpen}
      />
    </div>
  );
}
