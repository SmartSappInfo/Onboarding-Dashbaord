'use client';

/**
 * @fileOverview Executive KPI Header for Payment Reconciliation Workspace (Phase 12 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Mobile-First Touch Standards),
 * Rule 11 (Double-Entry Rounding & Determinism), and Rule 61 (Three-Zone Mission Control Layout).
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { type ReconciliationMetrics } from '@/platform/agents/finance/reconciliation/reconciliation-types';
import { AlertCircle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';

export interface ReconciliationKPIHeaderProps {
  metrics?: ReconciliationMetrics | null;
  isLoading?: boolean;
}

export function ReconciliationKPIHeader({
  metrics,
  isLoading = false,
}: ReconciliationKPIHeaderProps) {
  const currency = metrics?.currency ?? 'GHS';

  const cards = [
    {
      title: 'Unmatched Settlements',
      value: isLoading ? '...' : (metrics?.unmatchedSettlementsCount ?? 0).toString(),
      subtext: isLoading
        ? 'Loading...'
        : `${(metrics?.unmatchedSettlementsAmount ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency}`,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Matched Today',
      value: isLoading ? '...' : (metrics?.matchedTodayCount ?? 0).toString(),
      subtext: isLoading
        ? 'Loading...'
        : `${(metrics?.matchedTodayAmount ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency}`,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Flagged Discrepancies',
      value: isLoading ? '...' : (metrics?.flaggedDiscrepanciesCount ?? 0).toString(),
      subtext: 'Requires manual review',
      icon: AlertCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      title: 'Net Discrepancy Amount',
      value: isLoading
        ? '...'
        : `${(metrics?.totalNetDiscrepancyAmount ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency}`,
      subtext: 'Variance drift across settlements',
      icon: TrendingDown,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className="border border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl"
          >
            <CardContent className="p-4 sm:p-4.5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </span>
                <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {card.value}
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {card.subtext}
                </div>
              </div>
              <div
                className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${card.bg} ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
