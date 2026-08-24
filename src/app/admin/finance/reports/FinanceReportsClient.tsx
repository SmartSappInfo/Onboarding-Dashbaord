'use client';

/**
 * SmartSapp Finance 2.0 - Executive Financial Reporting Studio
 * Powered by ModularReportStudio, with sub-tabs for Executive Telemetry, Revenue, Aging, and Tax Audit.
 */

import * as React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  Receipt, 
  Layers, 
  Scale 
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  DateRangePreset, 
  ExecutiveFinanceMetrics, 
  CollectorPerformanceMetric, 
  FinancialAccount, 
  ReportColumn,
  ReportMetricItem 
} from '@/lib/types';
import { 
  getExecutiveFinanceMetricsAction, 
  getCashflowTrendAction, 
  getCollectorLeaderboardAction 
} from '@/lib/reporting-actions';
import { 
  ModularReportingService, 
  RevenueReportRow, 
  AgingReportRow, 
  TaxAuditReportRow 
} from '@/lib/services/modular-reporting-service';
import { MonthlyCashflowPoint } from '@/lib/services/finance-reporting-service';
import { ReportExportService } from '@/lib/services/report-export-service';
import { ModularReportStudio, ReportTabConfig } from '@/components/finance/reports/ModularReportStudio';
import { ReportMetricsGrid } from '@/components/finance/reports/ReportMetricsGrid';
import { ReportDataTable } from '@/components/finance/reports/ReportDataTable';
import Link from 'next/link';

export function FinanceReportsClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [metrics, setMetrics] = React.useState<ExecutiveFinanceMetrics | null>(null);
  const [trend, setTrend] = React.useState<MonthlyCashflowPoint[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<CollectorPerformanceMetric[]>([]);

  // Sub-tab report payloads
  const [revenueData, setRevenueData] = React.useState<{ metrics: ReportMetricItem[]; rows: RevenueReportRow[] }>({ metrics: [], rows: [] });
  const [agingData, setAgingData] = React.useState<{ metrics: ReportMetricItem[]; rows: AgingReportRow[] }>({ metrics: [], rows: [] });
  const [taxData, setTaxData] = React.useState<{ metrics: ReportMetricItem[]; rows: TaxAuditReportRow[] }>({ metrics: [], rows: [] });

  // Top Debtors Query
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

  const loadData = React.useCallback(async (preset: DateRangePreset = 'this_month', start?: string, end?: string) => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsLoading(true);

    try {
      const [metricsRes, trendRes, leadRes, revReport, ageReport, taxReport] = await Promise.all([
        getExecutiveFinanceMetricsAction(activeWorkspaceId, user.uid),
        getCashflowTrendAction(activeWorkspaceId, user.uid),
        getCollectorLeaderboardAction(activeWorkspaceId, user.uid),
        ModularReportingService.getRevenueReport(activeWorkspaceId, preset, start, end),
        ModularReportingService.getAgingReport(activeWorkspaceId, preset, start, end),
        ModularReportingService.getTaxAuditReport(activeWorkspaceId, preset, start, end),
      ]);

      if (metricsRes.success && metricsRes.metrics) setMetrics(metricsRes.metrics);
      if (trendRes.success && trendRes.trend) setTrend(trendRes.trend);
      if (leadRes.success && leadRes.leaderboard) setLeaderboard(leadRes.leaderboard);

      setRevenueData({ metrics: revReport.metrics, rows: revReport.rows });
      setAgingData({ metrics: ageReport.metrics, rows: ageReport.rows });
      setTaxData({ metrics: taxReport.metrics, rows: taxReport.rows });
    } catch (e) {
      console.error('[FINANCE_REPORTS] Error loading reports:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, user?.uid]);

  React.useEffect(() => {
    loadData('this_month');
  }, [loadData]);

  // Export CSV Handler
  const handleExportCsv = (tabId: string) => {
    const wsName = activeWorkspace?.name || activeWorkspaceId || 'Workspace';

    if (tabId === 'executive' && metrics) {
      ReportExportService.exportToCsv({
        filename: `Executive_Summary_${activeWorkspaceId}`,
        title: `Executive Financial Summary - ${wsName}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Billed Revenue', `GHS ${metrics.totalBilledRevenue}`],
          ['Total Collected Revenue', `GHS ${metrics.totalCollectedRevenue}`],
          ['Total Outstanding AR', `GHS ${metrics.totalOutstandingAR}`],
          ['Total At-Risk Debt (>60d)', `GHS ${metrics.totalAtRiskDebt}`],
          ['Collection Efficiency Rate', `${metrics.collectionEfficiencyRate}%`],
          ['Total Invoices Issued', String(metrics.invoicesCount)],
          ['Paid Invoices', String(metrics.paidInvoicesCount)],
        ],
      });
    } else if (tabId === 'revenue') {
      ReportExportService.exportToCsv({
        filename: `Revenue_Report_${activeWorkspaceId}`,
        title: `Revenue & Invoicing Ledger - ${wsName}`,
        headers: ['Invoice #', 'Customer / Entity', 'Issued Date', 'Subtotal', 'Tax', 'Total Payable', 'Amount Paid', 'Balance Due', 'Status'],
        rows: revenueData.rows.map(r => [
          r.invoiceNumber,
          r.entityName,
          r.issuedDate,
          r.subtotal,
          r.taxAmount,
          r.totalPayable,
          r.amountPaid,
          r.balanceDue,
          r.status,
        ]),
      });
    } else if (tabId === 'aging') {
      ReportExportService.exportToCsv({
        filename: `Aging_Report_${activeWorkspaceId}`,
        title: `Accounts Receivable Aging Summary - ${wsName}`,
        headers: ['Account #', 'Debtor Name', 'Current (Not Due)', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Exposure', 'Risk Level'],
        rows: agingData.rows.map(r => [
          r.accountNumber,
          r.entityName,
          r.currentAmount,
          r.days1_30,
          r.days31_60,
          r.days61_90,
          r.days90_plus,
          r.totalBalance,
          r.riskLevel,
        ]),
      });
    } else if (tabId === 'tax_audit') {
      ReportExportService.exportToCsv({
        filename: `Tax_Audit_Report_${activeWorkspaceId}`,
        title: `VAT & Statutory Levies Audit Report - ${wsName}`,
        headers: ['Invoice #', 'Customer Name', 'Issued Date', 'Gross Amount', 'VAT Rate', 'VAT (GHS)', 'Levies (GHS)', 'Total Tax (GHS)'],
        rows: taxData.rows.map(r => [
          r.invoiceNumber,
          r.entityName,
          r.issuedDate,
          r.grossAmount,
          r.vatRate,
          r.vatAmount,
          r.levyAmount,
          r.totalTax,
        ]),
      });
    }
  };

  // Table Column Definitions
  const revenueColumns: ReportColumn<RevenueReportRow>[] = [
    {
      id: 'invoiceNumber',
      header: 'Invoice #',
      accessor: (r) => (
        <Link href={`/admin/finance/invoices/${r.invoiceId}`} className="font-mono font-bold text-primary hover:underline">
          {r.invoiceNumber}
        </Link>
      ),
    },
    { id: 'entityName', header: 'Customer', accessor: (r) => <span className="font-semibold">{r.entityName}</span> },
    { id: 'issuedDate', header: 'Issued Date', accessor: (r) => <span className="font-mono text-muted-foreground">{r.issuedDate}</span> },
    { id: 'totalPayable', header: 'Total Payable', align: 'right', accessor: (r) => <span className="font-mono font-semibold">GHS {r.totalPayable.toLocaleString()}</span> },
    { id: 'amountPaid', header: 'Paid', align: 'right', accessor: (r) => <span className="font-mono text-emerald-600 font-semibold">GHS {r.amountPaid.toLocaleString()}</span> },
    { id: 'balanceDue', header: 'Balance Due', align: 'right', accessor: (r) => <span className="font-mono text-rose-600 font-bold">GHS {r.balanceDue.toLocaleString()}</span> },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      accessor: (r) => (
        <Badge variant={r.status === 'paid' ? 'default' : 'outline'} className="text-[10px] uppercase">
          {r.status}
        </Badge>
      ),
    },
  ];

  const agingColumns: ReportColumn<AgingReportRow>[] = [
    { id: 'accountNumber', header: 'Account #', accessor: (r) => <span className="font-mono text-muted-foreground">{r.accountNumber}</span> },
    { id: 'entityName', header: 'Customer', accessor: (r) => <span className="font-semibold">{r.entityName}</span> },
    { id: 'currentAmount', header: 'Current', align: 'right', accessor: (r) => <span className="font-mono text-muted-foreground">GHS {r.currentAmount.toLocaleString()}</span> },
    { id: 'days1_30', header: '1-30d', align: 'right', accessor: (r) => <span className="font-mono text-blue-600">GHS {r.days1_30.toLocaleString()}</span> },
    { id: 'days31_60', header: '31-60d', align: 'right', accessor: (r) => <span className="font-mono text-amber-600">GHS {r.days31_60.toLocaleString()}</span> },
    { id: 'days61_90', header: '61-90d', align: 'right', accessor: (r) => <span className="font-mono text-orange-600">GHS {r.days61_90.toLocaleString()}</span> },
    { id: 'days90_plus', header: '90+d', align: 'right', accessor: (r) => <span className="font-mono text-rose-600 font-bold">GHS {r.days90_plus.toLocaleString()}</span> },
    { id: 'totalBalance', header: 'Total Exposure', align: 'right', accessor: (r) => <span className="font-mono font-bold text-foreground">GHS {r.totalBalance.toLocaleString()}</span> },
  ];

  const taxColumns: ReportColumn<TaxAuditReportRow>[] = [
    {
      id: 'invoiceNumber',
      header: 'Invoice #',
      accessor: (r) => (
        <Link href={`/admin/finance/invoices/${r.invoiceId}`} className="font-mono font-bold text-primary hover:underline">
          {r.invoiceNumber}
        </Link>
      ),
    },
    { id: 'entityName', header: 'Customer', accessor: (r) => <span className="font-semibold">{r.entityName}</span> },
    { id: 'issuedDate', header: 'Issued Date', accessor: (r) => <span className="font-mono text-muted-foreground">{r.issuedDate}</span> },
    { id: 'grossAmount', header: 'Gross Amount', align: 'right', accessor: (r) => <span className="font-mono">GHS {r.grossAmount.toLocaleString()}</span> },
    { id: 'vatAmount', header: 'VAT', align: 'right', accessor: (r) => <span className="font-mono text-amber-600">GHS {r.vatAmount.toLocaleString()}</span> },
    { id: 'levyAmount', header: 'Statutory Levies', align: 'right', accessor: (r) => <span className="font-mono text-amber-600">GHS {r.levyAmount.toLocaleString()}</span> },
    { id: 'totalTax', header: 'Total Tax', align: 'right', accessor: (r) => <span className="font-mono font-bold text-rose-600">GHS {r.totalTax.toLocaleString()}</span> },
  ];

  // Report Tabs Configuration
  const tabs: ReportTabConfig[] = [
    {
      id: 'executive',
      label: 'Executive Summary',
      icon: BarChart3,
      renderContent: () => (
        <div className="space-y-6">
          {metrics && (
            <ReportMetricsGrid
              metrics={[
                { id: 'billed', label: '1. What Did We Bill?', value: `GHS ${metrics.totalBilledRevenue.toLocaleString()}`, subtext: `${metrics.invoicesCount} total invoices` },
                { id: 'collected', label: '2. What Did We Collect?', value: `GHS ${metrics.totalCollectedRevenue.toLocaleString()}`, subtext: `${metrics.collectionEfficiencyRate}% collection efficiency`, variant: 'success' },
                { id: 'owed', label: '3. What Are We Owed?', value: `GHS ${metrics.totalOutstandingAR.toLocaleString()}`, subtext: 'Active receivables', variant: 'warning' },
                { id: 'risk', label: '4. What Is At Risk?', value: `GHS ${metrics.totalAtRiskDebt.toLocaleString()}`, subtext: 'Over 60 days overdue', variant: 'danger' },
              ]}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cashflow Trends */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="p-4 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  6-Month Invoiced vs Collected Cashflow
                </CardTitle>
                <CardDescription className="text-xs">
                  Monthly billing volume compared against realized collections.
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

            {/* Collector Performance */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="p-4 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-600" />
                  Collector Recovery Leaderboard
                </CardTitle>
                <CardDescription className="text-xs">
                  Recovery effectiveness and Promise-to-Pay success by officer.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    No collector performance data logged.
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
                          <TableCell className="text-center font-medium">{item.assignedCasesCount}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">GHS {item.recoveredAmount.toLocaleString()}</TableCell>
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

          {/* Top 10 Debtors */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Top Debtor Exposure (Top 10 Accounts)
                </CardTitle>
                <CardDescription className="text-xs">Accounts carrying largest credit risk.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-primary">
                <Link href="/admin/finance/receivables">View All Receivables &rarr;</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold">Account #</TableHead>
                    <TableHead className="text-xs font-bold">Customer Name</TableHead>
                    <TableHead className="text-xs font-bold text-right">Total Invoiced</TableHead>
                    <TableHead className="text-xs font-bold text-right">Total Paid</TableHead>
                    <TableHead className="text-xs font-bold text-right">Current Exposure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDebtors.map((debtor) => (
                    <TableRow key={debtor.id} className="hover:bg-muted/40 text-xs">
                      <TableCell className="font-mono text-muted-foreground font-semibold">{debtor.accountNumber}</TableCell>
                      <TableCell className="font-semibold text-foreground">{debtor.accountName}</TableCell>
                      <TableCell className="text-right font-mono">GHS {Number(debtor.totalInvoiced || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">GHS {Number(debtor.totalPaid || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600">GHS {Number(debtor.currentBalance || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'revenue',
      label: 'Revenue & Invoicing',
      icon: Receipt,
      renderContent: () => (
        <div className="space-y-6">
          <ReportMetricsGrid metrics={revenueData.metrics} />
          <ReportDataTable columns={revenueColumns} rows={revenueData.rows} />
        </div>
      ),
    },
    {
      id: 'aging',
      label: 'AR Aging & Exposure',
      icon: Layers,
      renderContent: () => (
        <div className="space-y-6">
          <ReportMetricsGrid metrics={agingData.metrics} />
          <ReportDataTable columns={agingColumns} rows={agingData.rows} />
        </div>
      ),
    },
    {
      id: 'tax_audit',
      label: 'Tax & VAT Audit',
      icon: Scale,
      renderContent: () => (
        <div className="space-y-6">
          <ReportMetricsGrid metrics={taxData.metrics} />
          <ReportDataTable columns={taxColumns} rows={taxData.rows} />
        </div>
      ),
    },
  ];

  return (
    <ModularReportStudio
      title="Financial Reports & Analytics"
      subtitle={`Institutional financial intelligence, revenue telemetry, and statutory audits for ${activeWorkspace?.name || activeWorkspaceId}.`}
      tabs={tabs}
      defaultTabId="executive"
      onExportCsv={handleExportCsv}
      onPrintPdf={() => window.print()}
      isLoading={isLoading}
    />
  );
}
