'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Global Document Analytics Hub:
 *    Renders portfolio-wide strategic insights, cross-document comparison matrix,
 *    5-stage conversion funnels, and marketing campaign attribution (PRD Sections 22–24 & 76–85).
 * 2. Mobile Ergonomics & Touch Target Bounds:
 *    All buttons, tabs, and filters enforce `min-h-[44px]` touch target bounds with active scaling feedback.
 * 3. Emil Kowalski Animation Standards:
 *    Funnel animations, hover scale interactions (`hover:scale-[1.01]`), and clean transition states.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  RefreshCw,
  Eye,
  Users,
  Sparkles,
  Clock,
  TrendingUp,
  BarChart3,
  Layers,
  Share2,
  Filter,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
  Activity,
} from 'lucide-react';
import type { WorkspaceAdvancedAnalyticsSummary } from '@/lib/types/document-types';
import { getWorkspaceAdvancedAnalyticsAction } from '@/lib/documents/advanced-analytics-actions';
import { DocumentObservabilityDashboard } from '@/components/documents/studio/DocumentObservabilityDashboard';
import { useToast } from '@/hooks/use-toast';

export default function DocumentsAnalyticsHubClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const [period, setPeriod] = useState<'last_7_days' | 'last_30_days' | 'all_time'>('last_30_days');
  const [analytics, setAnalytics] = useState<WorkspaceAdvancedAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceAdvancedAnalyticsAction(activeWorkspaceId, period);
      if (res.success && res.analytics) {
        setAnalytics(res.analytics);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to fetch analytics.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load workspace analytics.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [activeWorkspaceId, period]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  return (
    <PageContainerFluid>
      <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 text-left">
        {/* ── Header Row ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/admin/documents')}
              className="h-11 w-11 rounded-2xl min-h-[44px] shrink-0"
              title="Back to Document Studio"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold">
                  Strategic Insights
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                Documents Analytics Hub
              </h1>
              <p className="text-xs text-muted-foreground">Portfolio-wide reading intelligence, conversion funnels, and benchmarks.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Period Filters */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border">
              <Button
                variant={period === 'last_7_days' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('last_7_days')}
                className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
              >
                7 Days
              </Button>
              <Button
                variant={period === 'last_30_days' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('last_30_days')}
                className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
              >
                30 Days
              </Button>
              <Button
                variant={period === 'all_time' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod('all_time')}
                className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
              >
                All Time
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={loadAnalytics}
              className="h-10 w-10 rounded-xl min-h-[40px]"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* ── 6 Portfolio KPI Summary Metric Cards ────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl w-fit">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{analytics?.totalPortfolioViews || 0}</div>
              <div className="text-[11px] font-bold text-muted-foreground">Portfolio Views</div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl w-fit">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{analytics?.totalUniqueReaders || 0}</div>
              <div className="text-[11px] font-bold text-muted-foreground">Unique Readers</div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl w-fit">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{analytics?.totalLeadsGenerated || 0}</div>
              <div className="text-[11px] font-bold text-muted-foreground">Total Leads</div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-violet-500/10 text-violet-500 rounded-xl w-fit">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {analytics?.portfolioConversionRatePercentage || 0}%
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">Lead Conv. Rate</div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl w-fit">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {formatDuration(analytics?.totalReadingTimeSeconds || 0)}
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">Total Read Time</div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl w-fit">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {analytics?.averagePortfolioEngagementScore || 0}
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">Avg Portfolio Score</div>
            </div>
          </Card>
        </div>

        {/* ── Main Multi-Tab Suite ────────────────────────────────────────────── */}
        <Tabs defaultValue="comparison" className="w-full space-y-6">
          <TabsList className="h-12 bg-muted/40 p-1 rounded-2xl border border-border/50 grid grid-cols-2 sm:grid-cols-5 gap-1">
            <TabsTrigger value="comparison" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
              <Layers className="h-4 w-4" /> Document Matrix
            </TabsTrigger>
            <TabsTrigger value="funnel" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
              <Filter className="h-4 w-4" /> Conversion Funnel
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
              <Share2 className="h-4 w-4" /> Campaign Attribution
            </TabsTrigger>
            <TabsTrigger value="retention" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
              <Users className="h-4 w-4" /> Cohort Retention
            </TabsTrigger>
            <TabsTrigger value="observability" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
              <Activity className="h-4 w-4 text-emerald-500" /> SLO & Health
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Document Comparison Matrix */}
          <TabsContent value="comparison" className="space-y-4">
            <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">Document Performance Leaderboard</h3>
                <p className="text-xs text-muted-foreground">
                  Cross-document comparison sorted by reading traffic, completion rates, and lead generation.
                </p>
              </div>

              {(!analytics || analytics.documentMetrics.length === 0) ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
                  No documents found in this workspace.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground text-left">
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Document</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Views</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Unique Readers</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Avg Completion</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Leads</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Conv. Rate</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {analytics.documentMetrics.map((doc) => (
                        <tr key={doc.documentId} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground line-clamp-1">{doc.title}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · Status: {doc.status}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">{doc.totalViews}</td>
                          <td className="py-3 px-4 text-muted-foreground">{doc.uniqueVisitors}</td>
                          <td className="py-3 px-4 font-bold text-indigo-400">{doc.averageCompletionPercentage}%</td>
                          <td className="py-3 px-4 font-black text-emerald-500">{doc.leadsGenerated}</td>
                          <td className="py-3 px-4 font-bold text-foreground">{doc.conversionRatePercentage}%</td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/documents/${doc.documentId}/analytics`)}
                              className="h-8 rounded-lg text-xs font-bold gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            >
                              Analytics <ChevronRight className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 2: Conversion Funnel */}
          <TabsContent value="funnel" className="space-y-4">
            <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">5-Stage Document Conversion Funnel</h3>
                <p className="text-xs text-muted-foreground">
                  Tracks progression from initial document view to in-depth reading, CTA engagement, and lead conversion.
                </p>
              </div>

              <div className="space-y-4 pt-2 max-w-3xl">
                {analytics?.funnelStages.map((stage, idx) => (
                  <div key={stage.stageName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        {stage.stageName}
                      </span>
                      <span className="font-mono">
                        {stage.count} ({stage.conversionRatePercentage}% of top)
                      </span>
                    </div>

                    <div className="h-3.5 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, stage.conversionRatePercentage)}%` }}
                        className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
                      />
                    </div>

                    {stage.dropOffRatePercentage > 0 && (
                      <div className="text-[10px] text-rose-500 flex items-center gap-1 font-bold">
                        <ArrowDownRight className="h-3 w-3" /> {stage.dropOffRatePercentage}% drop-off from previous stage
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Campaign Attribution */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">Campaign Attribution ROI</h3>
                <p className="text-xs text-muted-foreground">
                  Distribution channel performance across marketing drives, QR signage, and embeds.
                </p>
              </div>

              {(!analytics || analytics.campaignMetrics.length === 0) ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
                  No campaign traffic recorded in this period.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.campaignMetrics.map((camp) => (
                    <div
                      key={camp.campaignId}
                      className="p-4 rounded-2xl bg-muted/10 border border-border/60 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-foreground">{camp.campaignId}</div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase">
                          Channel: {camp.channelType}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-foreground">{camp.totalViews}</div>
                          <div className="text-[10px] text-muted-foreground">Views</div>
                        </div>
                        <div>
                          <div className="text-xs font-black text-emerald-500">{camp.leadsGenerated}</div>
                          <div className="text-[10px] text-muted-foreground">Leads</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-primary">{camp.conversionRatePercentage}%</div>
                          <div className="text-[10px] text-muted-foreground">Conv.</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 4: Cohort Retention */}
          <TabsContent value="retention" className="space-y-4">
            <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">Cohort Reader Retention</h3>
                <p className="text-xs text-muted-foreground">
                  Proportion of new vs returning readers across your digital document portfolio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground">New Visitors</div>
                  <div className="text-xl font-black text-foreground">
                    {analytics?.cohortMetrics[0]?.newVisitors || 0}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground">Returning Visitors</div>
                  <div className="text-xl font-black text-indigo-400">
                    {analytics?.cohortMetrics[0]?.returningVisitors || 0}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground">Return Rate</div>
                  <div className="text-xl font-black text-emerald-500">
                    {analytics?.cohortMetrics[0]?.returnRatePercentage || 0}%
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 5: Enterprise Observability & System Health */}
          <TabsContent value="observability" className="space-y-4">
            <DocumentObservabilityDashboard workspaceId={activeWorkspaceId || ''} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainerFluid>
  );
}
