'use client';

/**
 * @fileOverview Predictive Cash Flow Cockpit Client Component (Phase 12 Milestone 5)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets)
 * - Rule 61 (Three-Zone Mission Control Layout)
 * - Rule 62 (Real-time SSE reactivity via useEventStream)
 * - .agents/AGENTS.md (Actionable Toast Navigation with relative paths)
 * - theme.md §8 (Standardized Modal & Dialog Architecture)
 */

import React, { useState, useCallback } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  type CashFlowForecastResult,
} from '@/platform/agents/finance/analytics/cash-flow-types';
import {
  type FinanceEmergencyControls,
  type FinanceControlSwitchKey,
} from '@/platform/policy/finance-control-policy';
import { type AttendanceAnomalyResult } from '@/platform/agents/school/school-operations-types';
import { CashFlowCockpitModal } from '@/components/finance/analytics/CashFlowCockpitModal';
import { EmergencyControlModal } from '@/components/finance/control/EmergencyControlModal';
import { SchoolOperationsCockpitModal } from '@/components/school/SchoolOperationsCockpitModal';
import {
  toggleFinanceEmergencySwitchAction,
  getFinanceEmergencyControlsAction,
} from '@/app/actions/finance-control-actions';
import { PageContainerFluid } from '@/components/ui/page-container';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Clock,
  ShieldAlert,
  GraduationCap,
  RefreshCw,
  DollarSign,
  ArrowUpRight,
  Building2,
  Sliders,
} from 'lucide-react';

export interface CashFlowClientProps {
  initialForecast: CashFlowForecastResult;
  initialControls: FinanceEmergencyControls;
  initialAnomalies?: AttendanceAnomalyResult[];
}

export function CashFlowClient({
  initialForecast,
  initialControls,
  initialAnomalies = [],
}: CashFlowClientProps) {
  const { toast } = useToast();

  const [forecast] = useState<CashFlowForecastResult>(initialForecast);
  const [controls, setControls] = useState<FinanceEmergencyControls>(initialControls);
  const [anomalies] = useState<AttendanceAnomalyResult[]>(initialAnomalies);
  const [selectedHorizon, setSelectedHorizon] = useState<'30d' | '60d' | '90d'>('30d');

  // Modal Open States
  const [isCockpitModalOpen, setIsCockpitModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isSchoolOpsModalOpen, setIsSchoolOpsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-Time SSE Reactivity (Rule 62)
  useEventStream({
    onActivity: (activity: Record<string, unknown>) => {
      const type = typeof activity.type === 'string' ? activity.type : '';
      if (type.startsWith('finance.') || type.startsWith('school.')) {
        refreshControls();
      }
    },
  });

  const refreshControls = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getFinanceEmergencyControlsAction();
      if (res.success && res.data) {
        setControls(res.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleToggleSwitch = async (
    switchKey: FinanceControlSwitchKey,
    enabled: boolean,
    reason: string
  ) => {
    const res = await toggleFinanceEmergencySwitchAction({ switchKey, enabled, reason });
    if (res.success && res.data) {
      setControls(res.data);
      toast({
        title: enabled ? 'Emergency Switch Engaged' : 'Emergency Switch Resumed',
        description: `Switch '${switchKey}' is now ${enabled ? 'PAUSED' : 'ACTIVE'}.`,
        variant: enabled ? 'destructive' : 'default',
        actionConfig: {
          path: '/admin/finance/cockpit',
          label: 'View Cockpit',
        },
      });
    } else {
      toast({
        title: 'Action Failed',
        description: res.error?.message ?? 'Failed to update control switch.',
        variant: 'destructive',
        actionConfig: {
          path: '/admin/finance/cockpit',
          label: 'Retry',
        },
      });
    }
  };

  const currency = forecast.currency || 'GHS';
  const runway = forecast.runwayProjections;
  const dso = forecast.dsoMetrics;
  const debtor = forecast.debtorConcentration;
  const isEmergencyActive = Object.values(controls.switches).some(Boolean);

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left font-figtree">
        {/* Header Zone */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Predictive Cash Flow Cockpit
            </h1>
            <CardInfoTooltip text="Deterministic 30/60/90-day cash runway projection, collections velocity, and school operations intelligence." />
            <Badge variant="outline" className="text-xs gap-1.5 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Forecasting
            </Badge>
          </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSchoolOpsModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] gap-2 text-xs"
          >
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            School Operations
            {anomalies.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {anomalies.length}
              </Badge>
            )}
          </Button>

          <Button
            variant={isEmergencyActive ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setIsEmergencyModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] gap-2 text-xs font-semibold"
          >
            <ShieldAlert className="h-4 w-4" />
            Emergency Controls
            {isEmergencyActive && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 bg-white text-destructive">
                PAUSED
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshControls}
            disabled={isRefreshing}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Emergency Active Warning Banner */}
      {isEmergencyActive && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Backoffice Emergency Freeze Active: </span>
              <span>{controls.pauseReason || 'Operational halt active.'}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEmergencyModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs shrink-0"
          >
            Manage Controls
          </Button>
        </div>
      )}

      {/* Zone 1: Executive KPI Cards (Rule 61) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Cash On Hand</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">
            {currency} {forecast.currentCashOnHand.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">Immediate liquidity</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>30d Runway</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {currency} {runway['30d'].projectedClosingCash.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            +{currency} {runway['30d'].totalProjectedInflow.toLocaleString()} inflow
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>60d Runway</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {currency} {runway['60d'].projectedClosingCash.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            +{currency} {runway['60d'].totalProjectedInflow.toLocaleString()} inflow
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>90d Runway</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <p className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {currency} {runway['90d'].projectedClosingCash.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            +{currency} {runway['90d'].totalProjectedInflow.toLocaleString()} inflow
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>DSO Velocity</span>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold tracking-tight text-foreground">{dso.dsoDays}d</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {dso.velocityBand}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">Benchmark: {dso.benchmarkDays}d</p>
        </div>
      </div>

      {/* Zone 2: Filter Toolbar (Rule 61) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-muted/20">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-2">Horizon View:</span>
          {(['30d', '60d', '90d'] as const).map((hz) => (
            <Button
              key={hz}
              size="sm"
              variant={selectedHorizon === hz ? 'default' : 'ghost'}
              onClick={() => setSelectedHorizon(hz)}
              className="rounded-lg text-xs h-8 px-3 active:scale-[0.97]"
            >
              {hz.toUpperCase()} Horizon
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCockpitModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs gap-1.5"
          >
            <Sliders className="h-3.5 w-3.5" />
            Inspect Detailed Projections
          </Button>
        </div>
      </div>

      {/* Zone 3: Interactive Data Grid & Runway Detail (Rule 61) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Horizon Breakdown Card */}
        <div className="lg:col-span-2 rounded-xl border border-border/80 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {selectedHorizon.toUpperCase()} Runway Inflow Breakdown
              </h3>
              <p className="text-xs text-muted-foreground">
                Weighted probability modeling across open invoices, installment milestones, and promises.
              </p>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              Horizon: {runway[selectedHorizon].horizonDays} Days
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
              <span className="text-xs text-muted-foreground">Expected Invoices (70% base)</span>
              <p className="text-lg font-bold font-mono">
                {currency} {runway[selectedHorizon].expectedInvoiceCash.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
              <span className="text-xs text-muted-foreground">Installment Plans (85% prob)</span>
              <p className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {currency} {runway[selectedHorizon].expectedInstallmentCash.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
              <span className="text-xs text-muted-foreground">Promises to Pay (65% prob)</span>
              <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {currency} {runway[selectedHorizon].expectedPromiseCash.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Projected Closing Balance</p>
              <p className="text-2xl font-bold font-mono text-primary">
                {currency} {runway[selectedHorizon].projectedClosingCash.toLocaleString()}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Total New Inflow:</p>
              <p className="font-mono font-semibold text-foreground">
                +{currency} {runway[selectedHorizon].totalProjectedInflow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Debtor Concentration Risk Column */}
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <Building2 className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-foreground">Debtor Concentration Risk</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Top Single Debtor:</span>
                <Badge
                  variant={debtor.concentrationTier === 'CRITICAL' ? 'destructive' : 'outline'}
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {debtor.concentrationTier}
                </Badge>
              </div>
              <p className="text-sm font-bold truncate">{debtor.topDebtorName}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                <span>Exposure:</span>
                <span className="font-mono font-semibold text-foreground">
                  {currency} {debtor.topDebtorExposure.toLocaleString()} ({debtor.topDebtorExposurePercent}%)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Top 5 Total Exposure:</span>
                <span className="font-mono font-bold">
                  {currency} {debtor.top5TotalExposure.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Share of Total Receivables:</span>
                <span className="font-mono font-bold">{debtor.top5TotalExposurePercent}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals Mounted (theme.md §8) */}
      <CashFlowCockpitModal
        isOpen={isCockpitModalOpen}
        onClose={() => setIsCockpitModalOpen(false)}
        forecast={forecast}
      />

      <EmergencyControlModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        controls={controls}
        onToggleSwitch={handleToggleSwitch}
      />

      <SchoolOperationsCockpitModal
        isOpen={isSchoolOpsModalOpen}
        onClose={() => setIsSchoolOpsModalOpen(false)}
        anomalies={anomalies}
        onDraftBrief={(studentId) => {
          setIsSchoolOpsModalOpen(false);
          toast({
            title: 'Drafting Parent Brief',
            description: `Draft briefing initialized for student ${studentId}.`,
            actionConfig: {
              path: '/admin/finance/cockpit',
              label: 'View Cockpit',
            },
          });
        }}
      />
    </div>
  </PageContainerFluid>
  );
}
