'use client';

/**
 * @fileOverview Standardized Predictive Cash Flow Cockpit Modal (Phase 12 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: Guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessibility: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97] min-h-[44px]`
 *
 * Implements Rules 4, 7, 11, 41:
 * - 30/60/90-day predictive cash runway projection
 * - DSO calculation and velocity bands
 * - Debtor concentration exposure index
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type CashFlowForecastResult } from '@/platform/agents/finance/analytics/cash-flow-types';
import {
  TrendingUp,
  Clock,
  Building2,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';

export interface CashFlowCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  forecast: CashFlowForecastResult | null;
  isLoading?: boolean;
}

export function CashFlowCockpitModal({
  isOpen,
  onClose,
  forecast,
  isLoading,
}: CashFlowCockpitModalProps) {
  if (!forecast && !isLoading) return null;

  const currency = forecast?.currency ?? 'GHS';
  const runway = forecast?.runwayProjections;
  const dso = forecast?.dsoMetrics;
  const debtor = forecast?.debtorConcentration;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-4xl p-0 overflow-hidden">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader
          demarcated
          className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Predictive Cash Flow Cockpit
            </DialogTitle>
            <CardInfoTooltip text="Predictive cash runway models payment velocity, installment plans, and accounts receivable aging with zero cent drift." />
          </div>
          <DialogDescription className="sr-only">
            Predictive cash runway forecast and liquidity model
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Cash On Hand</span>
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="text-lg font-bold tracking-tight">
                {currency} {(forecast?.currentCashOnHand ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Immediate liquidity</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>30d Closing</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {currency} {(runway?.['30d']?.projectedClosingCash ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Inflow: +{currency} {(runway?.['30d']?.totalProjectedInflow ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>60d Closing</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <p className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                {currency} {(runway?.['60d']?.projectedClosingCash ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Inflow: +{currency} {(runway?.['60d']?.totalProjectedInflow ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>DSO Velocity</span>
                <Clock className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-bold tracking-tight">{dso?.dsoDays ?? 0} Days</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {dso?.velocityBand ?? 'HEALTHY'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Target: 45 Days</p>
            </div>
          </div>

          {/* Runway Projections Breakdown */}
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/70 bg-muted/20 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                30 / 60 / 90-Day Inflow Projections
              </span>
              <span className="text-xs text-muted-foreground">Cent-level double-entry math</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['30d', '60d', '90d'] as const).map((key) => {
                const item = runway?.[key];
                return (
                  <div key={key} className="p-3 rounded-lg border border-border/50 bg-background space-y-2">
                    <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                      <span className="text-xs font-bold">{key.toUpperCase()} Runway</span>
                      <Badge variant="secondary" className="text-[10px]">
                        Horizon {item?.horizonDays}d
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Invoice Inflow:</span>
                        <span className="font-mono text-foreground font-medium">
                          {currency} {(item?.expectedInvoiceCash ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Installments:</span>
                        <span className="font-mono text-foreground font-medium">
                          {currency} {(item?.expectedInstallmentCash ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Promises to Pay:</span>
                        <span className="font-mono text-foreground font-medium">
                          {currency} {(item?.expectedPromiseCash ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-border/40 font-semibold text-foreground">
                        <span>Projected Balance:</span>
                        <span className="font-mono text-primary">
                          {currency} {(item?.projectedClosingCash ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Debtor Concentration Risk Box */}
          <div className="p-4 rounded-xl border border-border/70 bg-background/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Top Debtor Exposure</p>
                <p className="text-sm font-bold">{debtor?.topDebtorName ?? 'None'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Exposure: </span>
                <span className="font-mono font-semibold">
                  {currency} {(debtor?.topDebtorExposure ?? 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Receivables %: </span>
                <span className="font-mono font-semibold">{debtor?.topDebtorExposurePercent ?? 0}%</span>
              </div>
              <Badge
                variant={debtor?.concentrationTier === 'CRITICAL' ? 'destructive' : 'outline'}
                className="text-[11px]"
              >
                {debtor?.concentrationTier ?? 'LOW'} CONCENTRATION
              </Badge>
            </div>
          </div>
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]">
          <Button
            variant="outline"
            data-testid="cash-flow-close-btn"
            onClick={onClose}
            className="rounded-xl active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
