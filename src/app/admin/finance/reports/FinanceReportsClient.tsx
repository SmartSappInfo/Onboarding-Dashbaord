'use client';

/**
 * SmartSapp Finance 2.0 - Executive Financial Reports & Intelligence Studio
 * Answers the 4 core executive questions, cashflow trends, collector performance, and CSV exports.
 */

import * as React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Printer, 
  Loader2, 
  Users, 
  FileText,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  ExecutiveFinanceMetrics, 
  CollectorPerformanceMetric, 
  FinancialAccount 
} from '@/lib/types';
import { 
  getExecutiveFinanceMetricsAction, 
  getCashflowTrendAction, 
  getCollectorLeaderboardAction 
} from '@/lib/reporting-actions';
import { MonthlyCashflowPoint } from '@/lib/services/finance-reporting-service';
import Link from 'next/link';

export function FinanceReportsClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [metrics, setMetrics] = React.useState<ExecutiveFinanceMetrics | null>(null);
  const [trend, setTrend] = React.useState<MonthlyCashflowPoint[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<CollectorPerformanceMetric[]>([]);

  // Query Top Debtors
  const debtorsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'financial_accounts'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('currentBalance', 'desc'),
      limit(10)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: rawDebtors } = useCollection<FinancialAccount>(debtorsQuery);
  const topDebtors = React.useMemo(() => rawDebtors || [], [rawDebtors]);

  const fetchReports = React.useCallback(async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsLoading(true);

    const [metricsRes, trendRes, leadRes] = await Promise.all([
      getExecutiveFinanceMetricsAction(activeWorkspaceId, user.uid),
      getCashflowTrendAction(activeWorkspaceId, user.uid),
      getCollectorLeaderboardAction(activeWorkspaceId, user.uid),
    ]);

    if (metricsRes.success && metricsRes.metrics) setMetrics(metricsRes.metrics);
    if (trendRes.success && trendRes.trend) setTrend(trendRes.trend);
    if (leadRes.success && leadRes.leaderboard) setLeaderboard(leadRes.leaderboard);

    setIsLoading(false);
  }, [activeWorkspaceId, user?.uid]);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export CSV
  const handleExportCSV = () => {
    if (!metrics) return;

    const rows = [
      ['Metric', 'Value'],
      ['Total Billed Revenue', `GHS ${metrics.totalBilledRevenue}`],
      ['Total Collected Revenue', `GHS ${metrics.totalCollectedRevenue}`],
      ['Total Outstanding AR', `GHS ${metrics.totalOutstandingAR}`],
      ['Total At-Risk Debt (>60d)', `GHS ${metrics.totalAtRiskDebt}`],
      ['Collection Efficiency Rate', `${metrics.collectionEfficiencyRate}%`],
      ['Total Invoices', `${metrics.invoicesCount}`],
      ['Paid Invoices', `${metrics.paidInvoicesCount}`],
      ['Active Debtors', `${metrics.debtorsCount}`],
      ['Active Collection Cases', `${metrics.activeCasesCount}`],
      [],
      ['Monthly Cashflow Trend', '', ''],
      ['Month', 'Billed (GHS)', 'Collected (GHS)'],
      ...trend.map(t => [t.month, String(t.billed), String(t.collected)]),
      [],
      ['Top Debtors Exposure', '', ''],
      ['Account Name', 'Account #', 'Current Balance (GHS)'],
      ...topDebtors.map(d => [d.accountName, d.accountNumber, String(d.currentBalance || 0)]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finance_Report_${activeWorkspaceId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <BarChart3 className="h-4 w-4" />
            Executive Financial Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Financial Reports &amp; Analytics
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Institutional revenue telemetry, cashflow recovery velocity, and debtor exposure for {activeWorkspace?.name || activeWorkspaceId}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print / PDF
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={!metrics}
            className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Compiling executive financial reports...</p>
        </div>
      ) : !metrics ? (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No financial metrics available.
        </div>
      ) : (
        <>
          {/* The 4 Executive Telemetry Questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: What did we bill? */}
            <Card className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 border-l-4 border-l-primary">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                1. What Did We Bill?
              </span>
              <div className="text-2xl font-black tracking-tight text-foreground">
                GHS {metrics.totalBilledRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Across <strong>{metrics.invoicesCount}</strong> issued invoices ({metrics.paidInvoicesCount} fully settled).
              </p>
            </Card>

            {/* Card 2: What did we collect? */}
            <Card className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  2. What Did We Collect?
                </span>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px]">
                  {metrics.collectionEfficiencyRate}% Rate
                </Badge>
              </div>
              <div className="text-2xl font-black tracking-tight text-emerald-600">
                GHS {metrics.totalCollectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total cash collected and posted to sub-ledger.
              </p>
            </Card>

            {/* Card 3: What are we owed? */}
            <Card className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 border-l-4 border-l-amber-500">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                3. What Are We Owed?
              </span>
              <div className="text-2xl font-black tracking-tight text-amber-600">
                GHS {metrics.totalOutstandingAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Current outstanding accounts receivable balance.
              </p>
            </Card>

            {/* Card 4: What is at risk? */}
            <Card className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 border-l-4 border-l-rose-500">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                4. What Is At Risk?
              </span>
              <div className="text-2xl font-black tracking-tight text-rose-600">
                GHS {metrics.totalAtRiskDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Delinquent debt over 60 days overdue ({metrics.activeCasesCount} active collection cases).
              </p>
            </Card>
          </div>

          {/* 2-Column Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Cashflow Trends */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="p-4 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  6-Month Invoiced vs Collected Cashflow
                </CardTitle>
                <CardDescription className="text-xs">
                  Monthly billing volume compared against realized cash collections.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {trend.map((point) => {
                  const maxVal = Math.max(...trend.map(t => Math.max(t.billed, t.collected)), 1);
                  const billedPct = Math.round((point.billed / maxVal) * 100);
                  const collectedPct = Math.round((point.collected / maxVal) * 100);

                  return (
                    <div key={point.month} className="space-y-1.5 p-2.5 rounded-xl border bg-card text-xs">
                      <div className="flex justify-between font-bold text-foreground">
                        <span className="font-mono">{point.month}</span>
                        <div className="flex gap-3 text-[11px]">
                          <span className="text-primary font-mono">Billed: GHS {point.billed.toLocaleString()}</span>
                          <span className="text-emerald-600 font-mono">Collected: GHS {point.collected.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Visual Bar Progression */}
                      <div className="space-y-1 pt-1">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${billedPct}%` }} />
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${collectedPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right: Collector Performance Leaderboard */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="p-4 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-600" />
                  Collector Recovery Performance
                </CardTitle>
                <CardDescription className="text-xs">
                  Recovery effectiveness and Promise-to-Pay fulfillment rates by officer.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    No active collection performance data logged.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-bold">Officer</TableHead>
                        <TableHead className="text-xs font-bold text-center">Cases</TableHead>
                        <TableHead className="text-xs font-bold text-right">Recovered</TableHead>
                        <TableHead className="text-xs font-bold text-center">PTP Success</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((item, idx) => (
                        <TableRow key={item.userId} className="hover:bg-muted/40 text-xs">
                          <TableCell className="font-semibold text-foreground">
                            <span className="font-mono text-muted-foreground mr-1.5">#{idx + 1}</span>
                            {item.userName}
                          </TableCell>

                          <TableCell className="text-center font-medium">
                            {item.assignedCasesCount}
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-emerald-600">
                            GHS {item.recoveredAmount.toLocaleString()}
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold text-[10px]">
                              {item.ptpSuccessRate}% ({item.fulfilledPromisesCount} fulfilled)
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Debtor Exposure Table */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Top Debtor Exposure (Top 10 Accounts)
                </CardTitle>
                <CardDescription className="text-xs">
                  Institutional accounts carrying the largest outstanding credit risk.
                </CardDescription>
              </div>

              <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-primary">
                <Link href="/admin/finance/receivables">View All Receivables &rarr;</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {topDebtors.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No debtor accounts with outstanding balances.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-bold">Account #</TableHead>
                      <TableHead className="text-xs font-bold">Customer Name</TableHead>
                      <TableHead className="text-xs font-bold text-right">Total Invoiced</TableHead>
                      <TableHead className="text-xs font-bold text-right">Total Paid</TableHead>
                      <TableHead className="text-xs font-bold text-right">Current Exposure</TableHead>
                      <TableHead className="text-xs font-bold text-right">Statement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topDebtors.map((debtor) => (
                      <TableRow key={debtor.id} className="hover:bg-muted/40 text-xs">
                        <TableCell className="font-mono text-muted-foreground font-semibold">
                          {debtor.accountNumber}
                        </TableCell>

                        <TableCell className="font-semibold text-foreground">
                          {debtor.accountName}
                        </TableCell>

                        <TableCell className="text-right font-mono text-muted-foreground">
                          {debtor.currency || 'GHS'} {Number(debtor.totalInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-right font-mono text-emerald-600">
                          {debtor.currency || 'GHS'} {Number(debtor.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-rose-600">
                          {debtor.currency || 'GHS'} {Number(debtor.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary font-bold">
                            <Link href={`/admin/finance/accounts/${debtor.id}/statement`}>
                              <FileText className="h-3 w-3 mr-1" /> Statement
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
