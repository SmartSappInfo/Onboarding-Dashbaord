/**
 * @fileoverview Platform Control Plane Financial Operations Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Aggregates cross-tenant MRR/ARR, gateway health radar, and aging debt triage.
 * - Minimum 44px touch targets on all interactive controls.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Banknote,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Loader2,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { getFinancialOverviewAction } from '@/lib/backoffice/backoffice-finance-actions';
import type {
  RevenueMetrics,
  GatewayHealthStatus,
  OverdueInvoiceItem,
} from '@/lib/backoffice/backoffice-types';
import GatewayHealthRadar from './GatewayHealthRadar';
import AgingDebtInspector from './AgingDebtInspector';

export default function FinanceMonitorClient() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [revenue, setRevenue] = React.useState<RevenueMetrics | null>(null);
  const [gateways, setGateways] = React.useState<GatewayHealthStatus[]>([]);
  const [overdueInvoices, setOverdueInvoices] = React.useState<OverdueInvoiceItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchFinanceData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getFinancialOverviewAction(idToken);

      if (res.success && res.revenue && res.gateways) {
        setRevenue(res.revenue);
        setGateways(res.gateways);
        setOverdueInvoices(res.overdueInvoices || []);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load financial telemetry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Banknote className="h-6 w-6 text-emerald-500" />
            Financial Operations Monitor
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Platform MRR/ARR telemetry, payment gateway status radar, and aging overdue debt triage.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchFinanceData}
          disabled={isLoading}
          className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh Telemetry'}
        </Button>
      </div>

      {/* KPI Stats Grid */}
      {revenue && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Monthly Recurring (MRR)</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                ${revenue.monthlyRecurringRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">MRR</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Annual Run Rate (ARR)</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                ${revenue.annualRecurringRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground">ARR</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Collection Efficiency</span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {revenue.netRevenueCollectionRate}%
              </span>
              <span className="text-[11px] text-blue-500 font-bold">on-time</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Aging Overdue Receivables</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                ${revenue.totalAgingReceivables.toLocaleString()}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">in dunning</span>
            </div>
          </Card>
        </div>
      )}

      {/* Gateway Health Radar Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-500" />
          Payment Gateway Infrastructure Status
        </h2>
        <GatewayHealthRadar gateways={gateways} />
      </div>

      {/* Aging Debt Inspector Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Overdue Accounts & Dunning Triage
        </h2>
        <AgingDebtInspector
          overdueInvoices={overdueInvoices}
          onRefresh={fetchFinanceData}
        />
      </div>
    </div>
  );
}
