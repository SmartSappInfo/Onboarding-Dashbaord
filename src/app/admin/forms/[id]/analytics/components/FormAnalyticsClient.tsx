'use client';

/**
 * SmartSapp Forms 2.0: Master Form Analytics Command Center
 * 
 * Centralized dashboard integrating executive KPIs, multi-stage conversion
 * funnels, question friction heatmaps, time series trends, UTM attribution,
 * and device environment analytics.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  RefreshCw, 
  ArrowLeft, 
  Edit, 
  Inbox,
  Sparkles, 
} from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';

import AnalyticsKpiStrip from './AnalyticsKpiStrip';
import ConversionFunnelView from './ConversionFunnelView';
import QuestionFrictionHeatmap from './QuestionFrictionHeatmap';
import SubmissionsTrendChart from './SubmissionsTrendChart';
import UtmAttributionCard from './UtmAttributionCard';
import DeviceEnvironmentCard from './DeviceEnvironmentCard';
import ReportStudioModal from './ReportStudioModal';
import ScheduledReportDrawer from './ScheduledReportDrawer';
import { FileText, Clock } from 'lucide-react';

import type { FormAnalyticsSummary, AnalyticsDateRangePreset } from '@/lib/forms/form-analytics-types';
import { getFormAnalyticsAction, exportAnalyticsDataAsCsvAction } from '@/lib/forms/form-analytics-actions';

interface FormAnalyticsClientProps {
  id: string;
}

export default function FormAnalyticsClient({ id }: FormAnalyticsClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<AnalyticsDateRangePreset>('30d');
  const [summary, setSummary] = useState<FormAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);

  useSetBreadcrumb('Form Analytics', `/admin/forms/${id}/analytics`);

  const loadAnalytics = React.useCallback(async (range: AnalyticsDateRangePreset) => {
    setIsLoading(true);
    try {
      const data = await getFormAnalyticsAction(id, range);
      setSummary(data);
    } catch (err) {
      console.error('[FORMS:ANALYTICS] Load error:', err);
      toast({
        title: 'Error loading analytics',
        description: 'Failed to retrieve analytics metrics.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadAnalytics(dateRange);
  }, [dateRange, loadAnalytics]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportAnalyticsDataAsCsvAction(id, dateRange);
      if (res.success && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `form-analytics-${id}-${dateRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Export Complete',
          description: 'Analytics summary exported to CSV successfully.',
        });
      } else {
        toast({
          title: 'Export Failed',
          description: res.error || 'Could not export analytics data.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Export Error',
        description: 'An unexpected error occurred during export.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-12">
        {/* Top Header & Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/admin/forms/${id}`)}
                className="h-8 px-2 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Form
              </Button>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
                Analytics Engine 2.0
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Event & Conversion Intelligence
            </h1>
          </div>

          {/* Quick Action Navigation & Range Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Link Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/forms/${id}/edit`)}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Studio</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/forms/${id}/submissions`)}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Submissions</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/forms/${id}/optimize`)}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 min-h-[44px] sm:min-h-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Optimize</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportModalOpen(true)}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 min-h-[44px] sm:min-h-0"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Report Studio</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScheduleDrawerOpen(true)}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Schedule</span>
            </Button>

            {/* Date Range Selector */}
            <Select
              value={dateRange}
              onValueChange={(val) => setDateRange(val as AnalyticsDateRangePreset)}
            >
              <SelectTrigger className="h-10 w-[140px] rounded-2xl text-xs font-bold bg-background min-h-[44px] sm:min-h-0">
                <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* CSV Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting || isLoading}
              className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadAnalytics(dateRange)}
              disabled={isLoading}
              className="h-10 w-10 rounded-2xl min-h-[44px] sm:min-h-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-80 rounded-3xl" />
              <Skeleton className="h-80 rounded-3xl" />
            </div>
          </div>
        ) : !summary ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-border/60 space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">No analytics data available for this form yet.</p>
            <p className="text-xs text-muted-foreground/80">Publish and share your form link to begin collecting visitor telemetry.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── 1. Executive Performance KPI Strip ── */}
            <AnalyticsKpiStrip summary={summary} />

            {/* ── 2. Conversion Funnel & Volume Trends ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversionFunnelView stages={summary.funnelStages} />
              <SubmissionsTrendChart trends={summary.trends} />
            </div>

            {/* ── 3. Question Friction & Drop-Off Heatmap ── */}
            <QuestionFrictionHeatmap questions={summary.questionFriction} />

            {/* ── 4. Traffic Attribution & Device Environment ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UtmAttributionCard attribution={summary.attribution} />
              <DeviceEnvironmentCard deviceBreakdown={summary.deviceBreakdown} />
            </div>
          </div>
        )}

        {/* ── Report Studio Modal & Scheduled Delivery Drawer (Phase 11) ── */}
        <ReportStudioModal
          formId={id}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
        <ScheduledReportDrawer
          formId={id}
          workspaceId={summary?.workspaceId}
          isOpen={isScheduleDrawerOpen}
          onClose={() => setIsScheduleDrawerOpen(false)}
        />
      </div>
    </PageContainer>
  );
}
