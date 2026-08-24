'use client';

/**
 * SmartSapp Finance 2.0 - Account Ledger Table
 * Tabular display of immutable sub-ledger debit and credit entries with running balances.
 */

import * as React from 'react';
import { FinancialTransaction, FinancialTransactionType } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowUpRight, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';

export interface AccountLedgerTableProps {
  transactions: FinancialTransaction[];
  currency?: string;
  isLoading?: boolean;
}

const transactionTypeStyles: Record<FinancialTransactionType, { label: string; badge: string; isDebit: boolean }> = {
  invoice_issued: { label: 'Invoice Issued', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', isDebit: true },
  payment_received: { label: 'Payment Received', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', isDebit: false },
  payment_allocated: { label: 'Payment Allocated', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', isDebit: false },
  credit_note: { label: 'Credit Note', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', isDebit: false },
  debit_note: { label: 'Debit Note', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', isDebit: true },
  refund: { label: 'Refund', badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', isDebit: true },
  adjustment: { label: 'Adjustment', badge: 'bg-muted text-muted-foreground border-border', isDebit: false },
  write_off: { label: 'Write-off', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', isDebit: false },
  reversal: { label: 'Reversal', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', isDebit: false },
};

export const AccountLedgerTable: React.FC<AccountLedgerTableProps> = ({
  transactions,
  currency = 'GHS',
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border shadow-xs">
        <CardHeader className="p-5 bg-muted/20 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Sub-Ledger Entries
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Loading audit entries...</CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCcw className="h-4 w-4 animate-spin" /> Retrieving financial ledger...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border shadow-xs overflow-hidden">
      <CardHeader className="p-5 bg-muted/20 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Sub-Ledger Entries
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Immutable debit and credit audit log for this financial account.
          </CardDescription>
        </div>
        <Badge variant="outline" className="rounded-lg text-xs font-semibold px-2.5">
          {transactions.length} Entries
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="p-12 text-center space-y-1">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground opacity-30" />
            <p className="text-xs font-semibold text-muted-foreground">No ledger transactions posted yet.</p>
            <p className="text-[11px] text-muted-foreground">
              Transactions will automatically appear when invoices are issued or payments are received.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Reference</th>
                  <th className="p-3.5 text-right">Debit (+)</th>
                  <th className="p-3.5 text-right">Credit (-)</th>
                  <th className="p-3.5 pr-5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {transactions.map((txn) => {
                  const style = transactionTypeStyles[txn.transactionType] || {
                    label: txn.transactionType,
                    badge: 'bg-muted text-muted-foreground',
                    isDebit: true,
                  };

                  let formattedDate = txn.effectiveAt;
                  try {
                    formattedDate = format(new Date(txn.effectiveAt), 'dd MMM yyyy, HH:mm');
                  } catch {
                    // Fallback to raw string
                  }

                  return (
                    <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 pl-5 font-medium text-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${style.badge}`}>
                          {style.isDebit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {style.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                        {txn.referenceNumber || txn.description || txn.referenceId}
                      </td>
                      <td className="p-3.5 text-right font-bold text-foreground">
                        {txn.debit > 0 ? `${currency} ${txn.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {txn.credit > 0 ? `${currency} ${txn.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3.5 pr-5 text-right font-bold text-foreground">
                        {currency} {txn.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
