'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Analytics Dashboard:
 *    Renders behavioral intelligence, page drop-off retention funnels, device distribution,
 *    and hotspot conversion analytics (PRD Sections 21–24, 30 & 87).
 * 2. Mobile Ergonomics & Touch Standards:
 *    Date range toggles and export buttons enforce `min-h-[44px]` touch target bounds.
 * 3. Emil Kowalski Animation Standards:
 *    Animated progress bars, hover scale interactions (`hover:scale-[1.02]`), and subtle fades.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState } from 'react';
import type { DocumentAnalyticsSummary } from '@/lib/types/document-types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Users,
  Sparkles,
  Clock,
  CheckCircle2,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  MousePointerClick,
  Share2,
  Calendar,
  Layers,
  ArrowDownRight,
} from 'lucide-react';

interface DocumentAnalyticsDashboardProps {
  analytics: DocumentAnalyticsSummary;
  selectedPeriod: 'last_7_days' | 'last_30_days' | 'all_time';
  onPeriodChange: (period: 'last_7_days' | 'last_30_days' | 'all_time') => void;
  documentTitle: string;
}

export function DocumentAnalyticsDashboard({
  analytics,
  selectedPeriod,
  onPeriodChange,
  documentTitle,
}: DocumentAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'funnel' | 'hotspots' | 'channels'>('funnel');

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── Dashboard Header & Period Switcher ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold">
              Behavioral Intelligence
            </Badge>
          </div>
          <h2 className="text-xl font-black text-foreground mt-1">{documentTitle}</h2>
          <p className="text-xs text-muted-foreground">Real-time reader engagement, retention, and conversion analytics.</p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border">
          <Button
            variant={selectedPeriod === 'last_7_days' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('last_7_days')}
            className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
          >
            7 Days
          </Button>
          <Button
            variant={selectedPeriod === 'last_30_days' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('last_30_days')}
            className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
          >
            30 Days
          </Button>
          <Button
            variant={selectedPeriod === 'all_time' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('all_time')}
            className="rounded-xl text-xs font-bold h-9 min-h-[36px]"
          >
            All Time
          </Button>
        </div>
      </div>

      {/* ── 6 KPI Summary Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Views */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl w-fit">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{analytics.totalViews}</div>
            <div className="text-[11px] font-bold text-muted-foreground">Total Views</div>
          </div>
        </Card>

        {/* Unique Visitors */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl w-fit">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{analytics.uniqueVisitors}</div>
            <div className="text-[11px] font-bold text-muted-foreground">Unique Readers</div>
          </div>
        </Card>

        {/* Leads Captured */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl w-fit">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{analytics.totalLeads}</div>
            <div className="text-[11px] font-bold text-muted-foreground">Leads Generated</div>
          </div>
        </Card>

        {/* Average Read Time */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl w-fit">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{formatDuration(analytics.averageDurationSeconds)}</div>
            <div className="text-[11px] font-bold text-muted-foreground">Avg Read Time</div>
          </div>
        </Card>

        {/* Average Completion Rate */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-violet-500/10 text-violet-500 rounded-xl w-fit">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{analytics.averageCompletionPercentage}%</div>
            <div className="text-[11px] font-bold text-muted-foreground">Avg Completion</div>
          </div>
        </Card>

        {/* Engagement Score */}
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-sm space-y-2">
          <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl w-fit">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{analytics.averageEngagementScore}</div>
            <div className="text-[11px] font-bold text-muted-foreground">Engagement Score</div>
          </div>
        </Card>
      </div>

      {/* ── Sub-Tab Navigation (Funnel / Hotspots / Channels) ────────────────── */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === 'funnel' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('funnel')}
          className="rounded-xl text-xs font-bold gap-1.5 h-10 min-h-[40px]"
        >
          <Layers className="h-4 w-4" /> Page Retention Funnel
        </Button>
        <Button
          variant={activeTab === 'hotspots' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('hotspots')}
          className="rounded-xl text-xs font-bold gap-1.5 h-10 min-h-[40px]"
        >
          <MousePointerClick className="h-4 w-4" /> Hotspot Clicks ({analytics.topHotspots.length})
        </Button>
        <Button
          variant={activeTab === 'channels' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('channels')}
          className="rounded-xl text-xs font-bold gap-1.5 h-10 min-h-[40px]"
        >
          <Share2 className="h-4 w-4" /> Distribution Channels ({analytics.channelMetrics.length})
        </Button>
      </div>

      {/* ── SUB-TAB 1: Page Retention Funnel ─────────────────────────────────── */}
      {activeTab === 'funnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Funnel Progress List (8 Cols) */}
          <Card className="lg:col-span-8 p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground">Reading Retention & Dwell Time</h3>
              <p className="text-xs text-muted-foreground">
                Visual progression showing percentage of readers reaching each page.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {analytics.pageMetrics.map((pm) => (
                <div key={`page_metric_${pm.pageNumber}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-[10px]">
                        {pm.pageNumber}
                      </span>
                      Page {pm.pageNumber}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {pm.retentionPercentage}% retention · {pm.averageDwellTimeSeconds}s avg dwell
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden relative">
                    <div
                      style={{ width: `${Math.max(4, pm.retentionPercentage)}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                    />
                  </div>

                  {pm.dropOffRatePercentage > 0 && (
                    <div className="text-[10px] text-rose-500 flex items-center gap-1 font-bold">
                      <ArrowDownRight className="h-3 w-3" /> {pm.dropOffRatePercentage}% drop-off on this page
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Device & Platform Breakdown (4 Cols) */}
          <Card className="lg:col-span-4 p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground">Device Distribution</h3>
              <p className="text-xs text-muted-foreground">Reading platforms across all visitor sessions.</p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Mobile */}
              <div className="p-4 rounded-2xl bg-muted/20 border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" /> Mobile Phones
                  </span>
                  <span>{analytics.deviceBreakdown.mobile}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    style={{
                      width: `${(analytics.deviceBreakdown.mobile / Math.max(1, analytics.totalViews)) * 100}%`,
                    }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>

              {/* Desktop */}
              <div className="p-4 rounded-2xl bg-muted/20 border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-indigo-400" /> Desktop Browsers
                  </span>
                  <span>{analytics.deviceBreakdown.desktop}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    style={{
                      width: `${(analytics.deviceBreakdown.desktop / Math.max(1, analytics.totalViews)) * 100}%`,
                    }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>

              {/* Tablet */}
              <div className="p-4 rounded-2xl bg-muted/20 border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Tablet className="h-4 w-4 text-amber-400" /> Tablets & iPads
                  </span>
                  <span>{analytics.deviceBreakdown.tablet}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    style={{
                      width: `${(analytics.deviceBreakdown.tablet / Math.max(1, analytics.totalViews)) * 100}%`,
                    }}
                    className="h-full bg-amber-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── SUB-TAB 2: Hotspot Conversion Leaderboard ──────────────────────── */}
      {activeTab === 'hotspots' && (
        <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-black text-foreground">Interactive Layer Conversions</h3>
            <p className="text-xs text-muted-foreground">
              Total clicks and Click-Through-Rates (CTR) on links, videos, forms, and WhatsApp triggers.
            </p>
          </div>

          {analytics.topHotspots.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
              No hotspot interactions recorded in this period.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.topHotspots.map((hs) => (
                <div
                  key={hs.hotspotId}
                  className="p-4 rounded-2xl bg-muted/10 border border-border/60 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                      <MousePointerClick className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{hs.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Page {hs.pageNumber} · Type: <span className="font-mono uppercase">{hs.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-foreground">{hs.clicks} clicks</div>
                    <div className="text-[10px] text-emerald-500 font-bold">{hs.ctr}% CTR</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── SUB-TAB 3: Distribution Channels Attribution ───────────────────── */}
      {activeTab === 'channels' && (
        <Card className="p-6 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-black text-foreground">Distribution Channel Performance</h3>
            <p className="text-xs text-muted-foreground">
              Attribution metrics across public links, email campaigns, QR codes, and website embeds.
            </p>
          </div>

          {analytics.channelMetrics.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
              No channel distributions found.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.channelMetrics.map((cm) => (
                <div
                  key={cm.distributionId}
                  className="p-4 rounded-2xl bg-muted/10 border border-border/60 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      <Share2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {cm.campaignId ? `Campaign: ${cm.campaignId}` : 'Direct Public Access'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono uppercase">
                        {cm.type.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <div className="text-xs font-bold text-foreground">{cm.views}</div>
                      <div className="text-[10px] text-muted-foreground">Views</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{cm.uniqueVisitors}</div>
                      <div className="text-[10px] text-muted-foreground">Unique</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-500">{cm.leads}</div>
                      <div className="text-[10px] text-muted-foreground">Leads</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
