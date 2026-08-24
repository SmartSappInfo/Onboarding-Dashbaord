'use client';

/**
 * SmartSapp Finance 2.0 - Accounts Receivable Command Center
 * Executive aging dashboard, debt risk intelligence, and customer exposure management.
 */

import * as React from 'react';
import { 
  Building2, 
  Search, 
  FileText, 
  CreditCard, 
  Loader2, 
  TrendingDown, 
  Clock, 
  ShieldAlert,
  FileMinus,
  Zap,
  BarChart3 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal';
import { CreateCreditNoteModal } from '@/components/finance/CreateCreditNoteModal';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { FinancialAccount, Invoice, AgingBucket, AgingSummary } from '@/lib/types';
import { calculateInvoiceAging } from '@/lib/services/aging-utils';
import Link from 'next/link';

export function ReceivablesClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { singular } = useTerminology();
  const firestore = useFirestore();

  const [agingFilter, setAgingFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [selectedAccountForPayment, setSelectedAccountForPayment] = React.useState<FinancialAccount | null>(null);
  const [selectedAccountForCredit, setSelectedAccountForCredit] = React.useState<FinancialAccount | null>(null);

  // Query Accounts
  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'financial_accounts'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('currentBalance', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<FinancialAccount>(accountsQuery);

  // Query Invoices for dynamic aging calculation
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'invoices'),
      where('workspaceIds', 'array-contains', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: invoices } = useCollection<Invoice>(invoicesQuery);

  // Dynamic Aging Map per Account
  const accountAgingMap = React.useMemo(() => {
    const map = new Map<string, {
      oldestDays: number;
      primaryBucket: AgingBucket;
      breakdown: { current: number; days1_30: number; days31_60: number; days61_90: number; days90Plus: number };
    }>();

    if (!invoices) return map;
    const now = new Date();

    invoices.forEach((inv: Invoice) => {
      if (
        inv.status === 'void' ||
        inv.lifecycleStatus === 'void' ||
        inv.status === 'draft' ||
        inv.status === 'paid' ||
        (inv.balanceDue !== undefined && inv.balanceDue <= 0)
      ) {
        return;
      }

      const accId = inv.accountId || inv.entityId || '';
      if (!accId) return;

      const aging = calculateInvoiceAging(inv, now);
      if (aging.balanceDue <= 0) return;

      let entry = map.get(accId);
      if (!entry) {
        entry = {
          oldestDays: 0,
          primaryBucket: 'current',
          breakdown: { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 },
        };
        map.set(accId, entry);
      }

      if (aging.daysOverdue > entry.oldestDays) {
        entry.oldestDays = aging.daysOverdue;
      }

      switch (aging.bucket) {
        case 'current':
          entry.breakdown.current = Math.round((entry.breakdown.current + aging.balanceDue) * 100) / 100;
          break;
        case '1_30':
          entry.breakdown.days1_30 = Math.round((entry.breakdown.days1_30 + aging.balanceDue) * 100) / 100;
          break;
        case '31_60':
          entry.breakdown.days31_60 = Math.round((entry.breakdown.days31_60 + aging.balanceDue) * 100) / 100;
          break;
        case '61_90':
          entry.breakdown.days61_90 = Math.round((entry.breakdown.days61_90 + aging.balanceDue) * 100) / 100;
          break;
        case '90_plus':
          entry.breakdown.days90Plus = Math.round((entry.breakdown.days90Plus + aging.balanceDue) * 100) / 100;
          break;
      }

      if (entry.breakdown.days90Plus > 0) entry.primaryBucket = '90_plus';
      else if (entry.breakdown.days61_90 > 0) entry.primaryBucket = '61_90';
      else if (entry.breakdown.days31_60 > 0) entry.primaryBucket = '31_60';
      else if (entry.breakdown.days1_30 > 0) entry.primaryBucket = '1_30';
      else entry.primaryBucket = 'current';
    });

    return map;
  }, [invoices]);

  // Aggregate Workspace Aging Summary
  const agingSummary: AgingSummary = React.useMemo(() => {
    const sum: AgingSummary = {
      totalReceivables: 0,
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      accountCount: 0,
      invoiceCount: 0,
    };

    if (!accounts) return sum;

    accounts.forEach((acc: FinancialAccount) => {
      const bal = Number(acc.currentBalance || 0);
      if (bal > 0) {
        sum.totalReceivables = Math.round((sum.totalReceivables + bal) * 100) / 100;
        sum.accountCount++;

        const entry = accountAgingMap.get(acc.id) || accountAgingMap.get(acc.entityId);
        if (entry) {
          sum.current = Math.round((sum.current + entry.breakdown.current) * 100) / 100;
          sum.days1_30 = Math.round((sum.days1_30 + entry.breakdown.days1_30) * 100) / 100;
          sum.days31_60 = Math.round((sum.days31_60 + entry.breakdown.days31_60) * 100) / 100;
          sum.days61_90 = Math.round((sum.days61_90 + entry.breakdown.days61_90) * 100) / 100;
          sum.days90Plus = Math.round((sum.days90Plus + entry.breakdown.days90Plus) * 100) / 100;
        } else {
          // If no specific invoice breakdown, treat as current
          sum.current = Math.round((sum.current + bal) * 100) / 100;
        }
      }
    });

    return sum;
  }, [accounts, accountAgingMap]);

  // Filtered Accounts
  const filteredAccounts = React.useMemo(() => {
    if (!accounts) return [];
    let list = accounts.filter((a: FinancialAccount) => Number(a.currentBalance || 0) > 0);

    if (agingFilter !== 'all') {
      list = list.filter((a: FinancialAccount) => {
        const entry = accountAgingMap.get(a.id) || accountAgingMap.get(a.entityId);
        return entry ? entry.primaryBucket === agingFilter : agingFilter === 'current';
      });
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(
        (a: FinancialAccount) =>
          a.accountName.toLowerCase().includes(s) ||
          a.accountNumber.toLowerCase().includes(s)
      );
    }

    return list;
  }, [accounts, agingFilter, searchTerm, accountAgingMap]);

  const getAgingBadge = (bucket: AgingBucket) => {
    switch (bucket) {
      case '90_plus':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px]">90+ Days Overdue</Badge>;
      case '61_90':
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 font-bold text-[10px]">61-90 Days</Badge>;
      case '31_60':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">31-60 Days</Badge>;
      case '1_30':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[10px]">1-30 Days</Badge>;
      default:
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">Current (Not Due)</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <TrendingDown className="h-7 w-7 text-primary" />
            Accounts Receivable
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Aging analysis, debt risk intelligence, and customer statement generation for {activeWorkspace?.name || activeWorkspaceId}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold"
          >
            <Link href="/admin/finance/automations">
              <Zap className="h-4 w-4 mr-1.5 text-primary" />
              Automations
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold"
          >
            <Link href="/admin/finance/reports">
              <BarChart3 className="h-4 w-4 mr-1.5 text-primary" />
              Reports
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
          >
            <Link href="/admin/finance/collections">
              <ShieldAlert className="h-4 w-4 mr-1.5" />
              Collections Pipeline
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Aging KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="rounded-3xl border-border bg-card shadow-sm col-span-2 sm:col-span-1 lg:col-span-1 border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Receivables</p>
            <h3 className="text-xl font-black text-foreground mt-1 truncate">
              GHS {agingSummary.totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-semibold text-muted-foreground mt-1">{agingSummary.accountCount} debtors</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current (Not Due)</p>
            <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
              GHS {agingSummary.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">
              {agingSummary.totalReceivables > 0 ? Math.round((agingSummary.current / agingSummary.totalReceivables) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">1–30 Days</p>
            <h3 className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1 truncate">
              GHS {agingSummary.days1_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Early follow-up</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">31–60 Days</p>
            <h3 className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
              GHS {agingSummary.days31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Reminder notice</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">61–90 Days</p>
            <h3 className="text-lg font-black text-orange-600 dark:text-orange-400 mt-1 truncate">
              GHS {agingSummary.days61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Escalated debt</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">90+ Days (High Risk)</p>
            <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 truncate">
              GHS {agingSummary.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Collection action</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <Tabs value={agingFilter} onValueChange={setAgingFilter} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 rounded-xl p-1 h-9 flex flex-wrap">
            <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-3">All Debts</TabsTrigger>
            <TabsTrigger value="current" className="rounded-lg text-xs font-bold px-3">Current</TabsTrigger>
            <TabsTrigger value="1_30" className="rounded-lg text-xs font-bold px-3">1–30d</TabsTrigger>
            <TabsTrigger value="31_60" className="rounded-lg text-xs font-bold px-3">31–60d</TabsTrigger>
            <TabsTrigger value="61_90" className="rounded-lg text-xs font-bold px-3">61–90d</TabsTrigger>
            <TabsTrigger value="90_plus" className="rounded-lg text-xs font-bold px-3 text-rose-600">90+d</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search debtor ${singular.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 min-h-[40px] rounded-xl text-xs bg-background font-medium"
          />
        </div>
      </div>

      {/* Receivables Table */}
      <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase pl-6 py-4">Account #</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Debtor {singular}</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right">Total Outstanding</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Oldest Debt</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Aging Risk</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAccounts ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <p className="text-xs font-semibold text-muted-foreground mt-2">Computing accounts receivable...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-bold text-foreground mt-2">No outstanding receivables found</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        All customer accounts in this filter are fully settled
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account: FinancialAccount) => {
                    const aging = accountAgingMap.get(account.id) || accountAgingMap.get(account.entityId);
                    const bucket = aging?.primaryBucket || 'current';
                    const oldestDays = aging?.oldestDays || 0;

                    return (
                      <TableRow key={account.id} className="border-border hover:bg-muted/20 transition-colors">
                        <TableCell className="pl-6 py-4 font-mono font-bold text-xs text-foreground">
                          {account.accountNumber}
                        </TableCell>
                        <TableCell className="font-bold text-xs text-foreground">
                          {account.accountName}
                        </TableCell>
                        <TableCell className="text-xs font-black text-foreground text-right">
                          {account.currency} {Number(account.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center font-medium text-xs text-muted-foreground">
                          {oldestDays > 0 ? (
                            <span className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" /> {oldestDays} days
                            </span>
                          ) : (
                            'Current'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getAgingBadge(bucket)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg active:scale-[0.97]"
                            >
                              <Link href={`/admin/finance/accounts/${account.id}/statement`}>
                                <FileText className="h-3.5 w-3.5 mr-1" /> Statement
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-500/10 rounded-lg active:scale-[0.97]"
                              onClick={() => setSelectedAccountForCredit(account)}
                              title="Issue Credit Note"
                            >
                              <FileMinus className="h-3.5 w-3.5 mr-1" /> Credit
                            </Button>

                            <Button
                              size="sm"
                              className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg active:scale-[0.97]"
                              onClick={() => setSelectedAccountForPayment(account)}
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <RecordPaymentModal
        isOpen={Boolean(selectedAccountForPayment)}
        onClose={() => setSelectedAccountForPayment(null)}
        account={selectedAccountForPayment}
      />

      <CreateCreditNoteModal
        isOpen={Boolean(selectedAccountForCredit)}
        onClose={() => setSelectedAccountForCredit(null)}
        account={selectedAccountForCredit}
      />
    </div>
  );
}
