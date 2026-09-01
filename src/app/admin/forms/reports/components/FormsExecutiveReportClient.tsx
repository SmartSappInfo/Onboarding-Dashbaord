'use client';

/**
 * SmartSapp Forms 2.0: Executive Cross-Form Reports & Analytics Client
 * 
 * Command center displaying workspace-wide form metrics, cohort comparisons,
 * top performing forms leaderboard, and CRM revenue attribution.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  Eye,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  Layers,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import type { WorkspaceExecutiveReportData, ReportDateRange } from '@/lib/forms/form-report-types';
import { getWorkspaceFormsExecutiveReportAction } from '@/lib/forms/form-reports-actions';
import { sanitizeCsvCell } from '@/lib/forms/form-response-actions';

interface FormsExecutiveReportClientProps {
  initialReport: WorkspaceExecutiveReportData;
  workspaceId: string;
}

export default function FormsExecutiveReportClient({
  initialReport,
  workspaceId,
}: FormsExecutiveReportClientProps) {
  const { toast } = useToast();
  const [report, setReport] = useState<WorkspaceExecutiveReportData>(initialReport);
  const [dateRange, setDateRange] = useState<ReportDateRange>(initialReport.dateRange || '30d');
  const [isLoading, setIsLoading] = useState(false);

  const handleDateRangeChange = async (range: ReportDateRange) => {
    setDateRange(range);
    setIsLoading(true);
    try {
      const res = await getWorkspaceFormsExecutiveReportAction({
        workspaceId,
        dateRange: range,
      });
      if (res.success && res.data) {
        setReport(res.data);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not refresh executive report.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    const formsRows = report.topPerformingForms.map(f => [
      sanitizeCsvCell(f.title),
      sanitizeCsvCell(f.slug),
      sanitizeCsvCell(f.totalSubmissions),
      sanitizeCsvCell(f.totalViews),
      sanitizeCsvCell(`${f.completionRate}%`),
      sanitizeCsvCell(`$${f.pipelineValueAttributed}`),
      sanitizeCsvCell(`${f.positiveSentimentPercentage}%`),
    ]);

    let csv = `Form Title,Slug,Submissions,Views,Completion Rate,Attributed Pipeline,Positive Sentiment\n`;
    formsRows.forEach(r => {
      csv += `${r.join(',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `executive-forms-report-${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Report Exported', description: `Downloaded executive CSV for ${dateRange}.` });
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-20">
        {/* ── Top Header Navigation & Controls ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground">
                <Link href="/admin/forms">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Forms
                </Link>
              </Button>
              <span className="text-muted-foreground/40">•</span>
              <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
                Executive Command Center
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <FileText className="h-6 w-6 text-primary" />
              Workspace Forms Executive Analytics
            </h1>
            <p className="text-xs text-muted-foreground">
              Cross-form conversion intelligence, revenue attribution, and cohort performance across {report.totalForms} active forms.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Select value={dateRange} onValueChange={handleDateRangeChange} disabled={isLoading}>
              <SelectTrigger className="w-36 h-9 rounded-xl text-xs font-bold bg-card border-border/60">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="rounded-xl h-9 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted min-h-[36px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* ── 1. Master KPI Cards Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Total Submissions */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Submissions
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{report.totalSubmissions}</span>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +14.5% vs prev
            </span>
          </div>

          {/* Total Views */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Aggregate Views
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{report.totalViews}</span>
              <Eye className="h-4 w-4 text-cyan-500" />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">Across all channels</span>
          </div>

          {/* Completion Rate */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Mean Completion Rate
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{report.averageCompletionRate}%</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> Healthy Funnel
            </span>
          </div>

          {/* Pipeline Revenue */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Pipeline Attributed
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">${report.totalPipelineRevenue.toLocaleString()}</span>
              <DollarSign className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">From form leads</span>
          </div>

          {/* Deals Won */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Closed-Won Revenue
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">${report.totalClosedWonRevenue.toLocaleString()}</span>
              <Briefcase className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{report.totalDealsWon} Deals Won</span>
          </div>

          {/* AI Positive Sentiment */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Positive Sentiment
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{report.positiveSentimentPercentage}%</span>
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">AI Voice-of-Customer</span>
          </div>
        </div>

        {/* ── 2. Top Performing Forms Leaderboard ── */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Top Performing Forms Leaderboard</h3>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">Ranked by volume & conversion</span>
          </div>

          <div className="divide-y divide-border/30">
            {report.topPerformingForms.map((item, idx) => (
              <div key={item.formId} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                    <span className="text-[10px] text-muted-foreground font-mono">/p/f/{item.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-foreground block">{item.totalSubmissions}</span>
                    <span className="text-[10px] text-muted-foreground">Submissions</span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-600 block">{item.completionRate}%</span>
                    <span className="text-[10px] text-muted-foreground">Completion</span>
                  </div>

                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">${item.pipelineValueAttributed.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">Attributed</span>
                  </div>

                  <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl">
                    <Link href={`/admin/forms/${item.formId}/analytics`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}

            {report.topPerformingForms.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No active forms found in this workspace.
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Cohort Comparison & Channel Attribution Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period Cohort Comparison */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Period-over-Period Performance Cohorts
            </h3>

            <div className="space-y-3">
              {report.cohortComparison.map((cohort, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{cohort.periodLabel}</span>
                    <span className="text-xs font-black text-primary">{cohort.submissions} Submissions</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                    <span>Views: {cohort.views}</span>
                    <span className="text-emerald-600 font-bold">Conversion: {cohort.completionRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Channel Distribution */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-500" />
              Cross-Form Channel Distribution
            </h3>

            <div className="space-y-3">
              {report.channelBreakdown.map((ch, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">{ch.channel}</span>
                    <span className="text-muted-foreground">{ch.submissions} ({ch.percentage}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${ch.percentage}%` }}
                      className="h-full bg-gradient-to-r from-primary to-cyan-500 rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
