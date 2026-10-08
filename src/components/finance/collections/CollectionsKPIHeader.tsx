'use client';

/**
 * @fileOverview Executive KPI Header for Collections Action Desk (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Strict Zero-any typing)
 * - Rule 7 (Mobile-First Touch & Responsive Layout Standards)
 * - Rule 11 (Double-Entry Rounding & Currency Determinism)
 * - Rule 61 (Three-Zone Mission Control Layout: Zone 1 Executive Header)
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { type CollectionsMetrics } from '@/platform/agents/finance/collections/collections-types';
import {
  AlertTriangle,
  Users,
  HandCoins,
  FileSpreadsheet,
} from 'lucide-react';

export interface CollectionsKPIHeaderProps {
  metrics?: CollectionsMetrics | null;
  isLoading?: boolean;
}

export function CollectionsKPIHeader({
  metrics,
  isLoading = false,
}: CollectionsKPIHeaderProps) {
  const currency = metrics?.currency ?? 'GHS';

  const cards = [
    {
      title: 'Overdue Receivables',
      value: isLoading
        ? '...'
        : `${(metrics?.totalReceivablesOverdue ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency}`,
      subtext: 'Aging receivables across ledger',
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      title: 'Debtor Accounts',
      value: isLoading ? '...' : (metrics?.debtorAccountsCount ?? 0).toString(),
      subtext: 'Accounts with overdue balances',
      icon: Users,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Active Promises to Pay',
      value: isLoading ? '...' : (metrics?.activePromisesCount ?? 0).toString(),
      subtext: isLoading
        ? 'Loading...'
        : `${(metrics?.promisesVolume ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency} committed`,
      icon: HandCoins,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Active Payment Plans',
      value: isLoading ? '...' : (metrics?.plansActiveCount ?? 0).toString(),
      subtext: isLoading
        ? 'Loading...'
        : `${(metrics?.plansRecoveredThisMonth ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency} recovered this month`,
      icon: FileSpreadsheet,
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
