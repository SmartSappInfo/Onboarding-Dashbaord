'use client';

/**
 * SmartSapp Forms 2.0: Report Builder Studio Modal
 * 
 * Interactive report generator supporting 5 presets, widget customization,
 * high-resolution browser print / PDF export, and sanitized CSV downloads.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Briefcase,
  Layers,
  Zap,
  Quote,
  Eye,
  DollarSign,
  Loader2,
  Settings2,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';
import type {
  FormReportPreset,
  FormReportData,
  ReportWidgetToggle,
} from '@/lib/forms/form-report-types';
import { generateFormCustomReportAction } from '@/lib/forms/form-reports-actions';
import { sanitizeCsvCell } from '@/lib/forms/form-utils';

interface ReportStudioModalProps {
  formId: string;
  formTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  initialPreset?: FormReportPreset;
}

const PRESETS: Array<{ id: FormReportPreset; label: string; icon: React.ReactNode; desc: string }> = [
  { id: 'executive_summary', label: 'Executive Summary', icon: <Sparkles className="h-4 w-4 text-primary" />, desc: 'KPIs, conversion funnel, AI voice-of-customer, and recommendations.' },
  { id: 'lead_generation', label: 'Lead & Revenue', icon: <Briefcase className="h-4 w-4 text-purple-500" />, desc: 'Pipeline value, won deals, and sales conversion metrics.' },
  { id: 'qualitative_research', label: 'Voice of Customer', icon: <Quote className="h-4 w-4 text-indigo-500" />, desc: 'Sentiment distribution, thematic topic clusters, and verbatim quotes.' },
  { id: 'campaign_attribution', label: 'Campaign Attribution', icon: <Layers className="h-4 w-4 text-cyan-500" />, desc: 'UTM sources, referral channels, and conversion efficiency.' },
  { id: 'ux_friction', label: 'UX Friction Audit', icon: <Zap className="h-4 w-4 text-amber-500" />, desc: 'Page stepper dwell times and field friction heatmap.' },
];

export default function ReportStudioModal({
  formId,
  formTitle = 'Form',
  isOpen,
  onClose,
  initialPreset = 'executive_summary',
}: ReportStudioModalProps) {
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<FormReportPreset>(initialPreset);
  const [reportData, setReportData] = useState<FormReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [widgets, setWidgets] = useState<ReportWidgetToggle>({
    kpiStrip: true,
    funnelProgression: true,
    submissionsTrend: true,
    frictionHeatmap: true,
    topicClusters: true,
    utmAttribution: true,
    revenueAttribution: true,
    deviceBreakdown: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadReport(selectedPreset);
    }
  }, [isOpen, selectedPreset, formId]);

  const loadReport = async (preset: FormReportPreset) => {
    setIsLoading(true);
    try {
      const res = await generateFormCustomReportAction({
        formId,
        preset,
      });
      if (res.success && res.report) {
        setReportData(res.report);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Could not compile report.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!reportData) return;

    let csv = `Metric,Value\n`;
    csv += `Form Title,${sanitizeCsvCell(reportData.formTitle)}\n`;
    csv += `Report Preset,${sanitizeCsvCell(selectedPreset)}\n`;
    csv += `Total Submissions,${reportData.kpiSummary.totalSubmissions}\n`;
    csv += `Total Views,${reportData.kpiSummary.totalViews}\n`;
    csv += `Completion Rate,${reportData.kpiSummary.completionRate}%\n`;
    csv += `Avg Dwell Seconds,${reportData.kpiSummary.avgDwellSeconds}s\n`;
    csv += `Attributed Pipeline Value,$${reportData.revenueAttribution.totalPipelineValue}\n`;
    csv += `Closed-Won Revenue,$${reportData.revenueAttribution.totalClosedWonRevenue}\n`;
    csv += `Deals Won Count,${reportData.revenueAttribution.totalDealsWon}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${reportData.formSlug || formId}-${selectedPreset}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Report Downloaded', description: 'Exported report data to CSV.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden border border-border/60 bg-background shadow-2xl">
        {/* Modal Top Toolbar */}
        <div className="p-4 px-6 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Report Builder Studio
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">{formTitle} Analytics & Intelligence Report</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              disabled={isLoading || !reportData}
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-bold gap-1.5 border-border/60 min-h-[36px]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </Button>

            <Button
              onClick={handleExportCsv}
              disabled={isLoading || !reportData}
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-bold gap-1.5 border-border/60 min-h-[36px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV Export</span>
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body: Two Columns (Controls Left, Preview Right) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Selector Strip */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Choose Standard Report Preset
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                    selectedPreset === p.id
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border/60 bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    {p.icon}
                    {selectedPreset === p.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <span className="text-xs font-bold text-foreground line-clamp-1">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Printable Report Canvas */}
          <div id="report-printable-area" className="p-6 rounded-3xl border border-border/60 bg-card space-y-6 shadow-xs">
            {isLoading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground font-semibold">Synthesizing report metrics...</p>
              </div>
            ) : reportData ? (
              <>
                {/* Report Header */}
                <div className="border-b border-border/40 pb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                      SMARTSAPP FORMS 2.0 REPORT
                    </span>
                    <h2 className="text-xl font-black text-foreground">{reportData.formTitle}</h2>
                    <p className="text-xs text-muted-foreground">
                      Preset: <span className="font-bold text-foreground capitalize">{selectedPreset.replace(/_/g, ' ')}</span> • Generated {new Date(reportData.generatedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold px-3 py-1">
                    /p/f/{reportData.formSlug}
                  </Badge>
                </div>

                {/* KPI Strip */}
                {widgets.kpiStrip && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Submissions</span>
                      <p className="text-xl font-black text-foreground">{reportData.kpiSummary.totalSubmissions}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Views</span>
                      <p className="text-xl font-black text-foreground">{reportData.kpiSummary.totalViews}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Conversion</span>
                      <p className="text-xl font-black text-emerald-600">{reportData.kpiSummary.completionRate}%</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Pipeline Value</span>
                      <p className="text-xl font-black text-purple-600 dark:text-purple-400">${reportData.revenueAttribution.totalPipelineValue.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Executive Summary */}
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Executive Summary
                  </p>
                  <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                    {reportData.executiveSummary}
                  </p>
                </div>

                {/* Revenue Attribution */}
                {widgets.revenueAttribution && (
                  <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" /> CRM Pipeline & Revenue Attribution
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Deals Generated</span>
                        <span className="font-bold text-foreground text-sm">{reportData.revenueAttribution.totalDealsCreated}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Closed-Won Deals</span>
                        <span className="font-bold text-emerald-600 text-sm">{reportData.revenueAttribution.totalDealsWon}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Deal Win Rate</span>
                        <span className="font-bold text-foreground text-sm">{reportData.revenueAttribution.winRate}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Realized Revenue</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">${reportData.revenueAttribution.totalClosedWonRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thematic Topic Clusters */}
                {widgets.topicClusters && reportData.topicClusters && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Quote className="h-4 w-4 text-indigo-500" /> Voice of Customer & AI Thematic Clusters
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {reportData.topicClusters.topThemes.slice(0, 2).map((t) => (
                        <div key={t.id} className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground">{t.topic}</h4>
                            <Badge variant="outline" className="text-[9px]">{t.percentageShare}% share</Badge>
                          </div>
                          {t.sampleQuotes?.[0] && (
                            <p className="text-[11px] text-muted-foreground italic">&ldquo;{t.sampleQuotes[0]}&rdquo;</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {reportData.strategicRecommendations?.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Actionable Recommendations
                    </span>
                    <ul className="space-y-1 text-xs text-foreground/90 font-medium">
                      {reportData.strategicRecommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
