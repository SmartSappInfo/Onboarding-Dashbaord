'use client';

/**
 * @fileOverview Reconciliation Exception Queue Table & Inspection Grid (Phase 12 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (44px Touch Targets & Mechanical Feedback),
 * Rule 11 (Double-Entry Rounding & Currency Formats), and Rule 41 (Confidence Meters).
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  type ReconciliationExceptionItem,
} from '@/platform/agents/finance/reconciliation/reconciliation-types';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileQuestion,
  HelpCircle,
  Smartphone,
  Wallet,
} from 'lucide-react';

export interface ReconciliationExceptionTableProps {
  exceptions: ReconciliationExceptionItem[];
  isLoading?: boolean;
  onInspect: (item: ReconciliationExceptionItem) => void;
  onQuickApprove?: (item: ReconciliationExceptionItem) => void;
}

export function ReconciliationExceptionTable({
  exceptions,
  isLoading = false,
  onInspect,
  onQuickApprove,
}: ReconciliationExceptionTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center border border-border/80 rounded-2xl bg-card">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p className="text-xs text-muted-foreground font-medium">Loading reconciliation exceptions...</p>
      </div>
    );
  }

  if (exceptions.length === 0) {
    return (
      <div className="p-10 text-center border border-dashed border-border/80 rounded-2xl bg-card/50 space-y-2">
        <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="text-sm font-bold text-foreground">Zero Discrepancies in Queue</div>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          All multi-channel payouts have been matched and reconciled to student and corporate fee invoices.
        </p>
      </div>
    );
  }

  const getGatewayIcon = (payoutId: string) => {
    const id = payoutId.toLowerCase();
    if (id.includes('momo') || id.includes('mtn') || id.includes('telecel')) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (id.includes('stripe') || id.includes('card')) {
      return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (id.includes('cash')) {
      return <Wallet className="w-3.5 h-3.5 text-emerald-500" />;
    }
    return <Building2 className="w-3.5 h-3.5 text-primary" />;
  };

  const getStatusBadge = (status: ReconciliationExceptionItem['status']) => {
    switch (status) {
      case 'RESOLVED':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
          >
            Resolved
          </Badge>
        );
      case 'IN_REVIEW':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 border-blue-500/30"
          >
            In Review
          </Badge>
        );
      case 'DISMISSED':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase bg-muted text-muted-foreground border-border"
          >
            Dismissed
          </Badge>
        );
      case 'OPEN':
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border-amber-500/30"
          >
            Open Queue
          </Badge>
        );
    }
  };

  return (
    <div className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/30 border-b border-border/80 text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Settlement Reference</th>
              <th className="py-3 px-4">Gateway</th>
              <th className="py-3 px-4">Discrepancy / Variance</th>
              <th className="py-3 px-4">Match Confidence</th>
              <th className="py-3 px-4">Queue Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground">
            {exceptions.map((item) => {
              const isDiscrepant = Math.abs(item.varianceAmount) > 0.5;
              const hasCandidate = item.candidateInvoices.length > 0;

              return (
                <tr
                  key={item.exceptionId}
                  className="hover:bg-muted/15 transition-colors group cursor-pointer"
                  onClick={() => onInspect(item)}
                >
                  <td className="py-3.5 px-4 font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold">{item.payoutReference}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-sans">
                      {new Date(item.createdAt).toLocaleDateString()} • {item.flaggedReason}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-medium">
                      {getGatewayIcon(item.payoutId)}
                      <span className="capitalize">{item.payoutId.split('_')[1] || 'Bank Wire'}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-foreground">
                      {item.amount.toFixed(2)} {item.currency}
                    </div>
                    {item.varianceAmount !== 0 ? (
                      <div
                        className={`text-[11px] font-mono font-medium ${
                          isDiscrepant
                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {item.varianceAmount > 0 ? `+${item.varianceAmount.toFixed(2)}` : item.varianceAmount.toFixed(2)}{' '}
                        {item.currency} drift
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Exact settlement amount
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.confidenceScore >= 80
                              ? 'bg-emerald-500'
                              : item.confidenceScore >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${item.confidenceScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px]">{item.confidenceScore}%</span>
                    </div>
                    {hasCandidate && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {item.candidateInvoices[0].invoiceNumber}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>

                  <td
                    className="py-3.5 px-4 text-right space-x-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onInspect(item)}
                      className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px] text-xs font-medium"
                    >
                      <span>3-Way Diff</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>

                    {item.status === 'OPEN' && !isDiscrepant && onQuickApprove && (
                      <Button
                        size="sm"
                        onClick={() => onQuickApprove(item)}
                        className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px] text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
