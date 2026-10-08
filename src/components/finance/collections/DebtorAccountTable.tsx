'use client';

/**
 * @fileOverview Interactive Debtor Account Grid Table (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Strict Zero-any / Zero-any[] typing policy)
 * - Rule 7 (Mobile-First >= 44px Touch Targets, active:scale-[0.97] mechanical feedback)
 * - Rule 11 (Double-Entry Financial Formatting)
 * - Rule 12 (Risk Level Badging & Visual Hierarchy)
 * - Rule 61 (Three-Zone Mission Control Layout: Zone 3 Interactive Data Grid)
 * - .agents/AGENTS.md (Tag Selection SSOT via <TagSelector> in client/draft mode)
 */

import React from 'react';
import {
  type DebtorAccount,
  type AgingBucket,
} from '@/platform/agents/finance/collections/collections-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  FileSpreadsheet,
  HandCoins,
  Sparkles,
  User,
  Phone,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export interface DebtorAccountTableProps {
  debtors: DebtorAccount[];
  isLoading?: boolean;
  onEvaluateDebtor: (debtor: DebtorAccount) => void;
  onProposePlan: (debtor: DebtorAccount) => void;
  onRecordPromise: (debtor: DebtorAccount) => void;
  onTagsChange?: (entityId: string, tagIds: string[]) => void;
}

export function DebtorAccountTable({
  debtors,
  isLoading = false,
  onEvaluateDebtor,
  onProposePlan,
  onRecordPromise,
  onTagsChange,
}: DebtorAccountTableProps) {
  const getAgingBadge = (bucket: AgingBucket, days: number) => {
    switch (bucket) {
      case '0_14_DAYS':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-mono">
            {days}d · 0–14 Days
          </Badge>
        );
      case '15_30_DAYS':
        return (
          <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-mono">
            {days}d · 15–30 Days
          </Badge>
        );
      case '31_60_DAYS':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-mono">
            {days}d · 31–60 Days
          </Badge>
        );
      case 'OVER_60_DAYS':
        return (
          <Badge variant="destructive" className="text-xs font-mono">
            {days}d · 60+ Days
          </Badge>
        );
    }
  };

  const getHealthBadge = (health: DebtorAccount['relationshipHealth']) => {
    switch (health) {
      case 'EXCELLENT':
        return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">EXCELLENT</Badge>;
      case 'GOOD':
        return <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px]">GOOD</Badge>;
      case 'FAIR':
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px]">FAIR</Badge>;
      case 'AT_RISK':
        return <Badge variant="destructive" className="text-[10px]">AT RISK</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="border border-border/80 rounded-2xl p-12 text-center bg-card shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading debtor accounts and aging schedules...</p>
      </div>
    );
  }

  if (debtors.length === 0) {
    return (
      <div className="border border-border/80 rounded-2xl p-12 text-center bg-card shadow-sm space-y-2">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h4 className="text-base font-semibold text-foreground">Zero Overdue Accounts Found</h4>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          All accounts in this filter view have settled balances or have no pending overdue invoices.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/30 border-b border-border/80 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Debtor Account</th>
              <th className="px-4 py-3.5 text-right">Outstanding</th>
              <th className="px-4 py-3.5">Aging & Days</th>
              <th className="px-4 py-3.5">Health & Commitment</th>
              <th className="px-4 py-3.5">Tags</th>
              <th className="px-5 py-3.5 text-right">Autonomous Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {debtors.map((debtor) => (
              <tr key={debtor.entityId} className="hover:bg-muted/15 transition-colors">
                {/* Account & Contact */}
                <td className="px-5 py-3.5 max-w-[260px]">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{debtor.entityName}</span>
                    </span>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                      <span>{debtor.primaryContactName}</span>
                      {debtor.studentId && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{debtor.studentId}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-0.5">
                      {debtor.primaryContactPhone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {debtor.primaryContactPhone}
                        </span>
                      )}
                      {debtor.primaryContactEmail && (
                        <span className="flex items-center gap-0.5">
                          <Mail className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{debtor.primaryContactEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Outstanding Balance */}
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {debtor.currency}{' '}
                    {debtor.totalOutstandingBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[10px] text-muted-foreground">Due: {debtor.oldestInvoiceDueDate}</p>
                </td>

                {/* Aging & Bucket */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {getAgingBadge(debtor.agingBucket, debtor.daysOverdue)}
                </td>

                {/* Relationship Health & Promises */}
                <td className="px-4 py-3.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {getHealthBadge(debtor.relationshipHealth)}
                    {debtor.brokenPromisesCount > 0 && (
                      <Badge variant="outline" className="border-rose-500/40 text-rose-500 text-[10px] font-mono">
                        {debtor.brokenPromisesCount} Broken
                      </Badge>
                    )}
                  </div>
                  {debtor.promiseToPayDate && debtor.promiseToPayAmount ? (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <HandCoins className="w-3 h-3 shrink-0" />
                      <span>
                        Promised {debtor.currency} {debtor.promiseToPayAmount.toFixed(0)} by {debtor.promiseToPayDate}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">No active promise</span>
                  )}
                </td>

                {/* Tags Single Source of Truth (<TagSelector> in client/draft mode) */}
                <td className="px-4 py-3.5 max-w-[180px]">
                  <TagSelector
                    currentTagIds={debtor.currentTagIds}
                    onTagsChange={(newTags) => onTagsChange?.(debtor.entityId, newTags)}
                  />
                </td>

                {/* 1-Click Action Triggers (Rule 7: min-h-[44px] and tactile feedback) */}
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onEvaluateDebtor(debtor)}
                      className="rounded-xl active:scale-[0.97] min-h-[44px] px-3.5 text-xs font-semibold gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Evaluate Action
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onProposePlan(debtor)}
                      className="rounded-xl active:scale-[0.97] min-h-[44px] px-3 text-xs font-medium gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                      Plan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRecordPromise(debtor)}
                      className="rounded-xl active:scale-[0.97] min-h-[44px] px-3 text-xs font-medium gap-1"
                    >
                      <HandCoins className="w-3.5 h-3.5 text-muted-foreground" />
                      Promise
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
