'use client';

/**
 * ARCHITECTURE:
 * Performance Intelligence & Attribution Client (Phase 10)
 * 
 * Renders executive-level financial attribution dashboards, CRM conversion funnels,
 * format conversion efficiency matrices, and cross-campaign benchmarks.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import type {
  CampaignAttributionSummary,
  PerformanceMetrics,
} from '@/lib/creative/creative-types';
import { calculateFormatEfficiency } from '@/lib/creative/creative-performance-engine';
import {
  BarChart3,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';

interface AnalyticsClientProps {
  initialCampaigns: CampaignAttributionSummary[];
  sampleMetrics: PerformanceMetrics[];
}

export function AnalyticsClient({
  initialCampaigns,
  sampleMetrics,
}: AnalyticsClientProps) {
  const [campaigns] = useState<CampaignAttributionSummary[]>(initialCampaigns);

  // Format efficiency computations
  const formatEfficiencies = calculateFormatEfficiency([
    { format: '16:9 Landscape', impressions: 48200, conversions: 184, revenue: 18400 },
    { format: '9:16 Story / Reel', impressions: 21500, conversions: 142, revenue: 14200 },
    { format: '1:1 Square', impressions: 16800, conversions: 88, revenue: 8800 },
  ]);

  const totalImpressions = campaigns.reduce((acc, c) => acc + c.totalImpressions, 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + c.totalConversions, 0);
  const totalRevenue = campaigns.reduce((acc, c) => acc + c.totalRevenue, 0);
  const avgRoas = sampleMetrics.length > 0
    ? Math.round((sampleMetrics.reduce((acc, m) => acc + m.roas, 0) / sampleMetrics.length) * 10) / 10
    : 5.8;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/creative-studio/projects"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white">Performance & Business Attribution</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Connect visual design elements directly to CRM leads, conversion pipelines, and Return on Ad Spend (ROAS).
          </p>
        </div>
      </div>

      {/* Top Financial KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-850 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Total Impressions</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {totalImpressions.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +24.8% vs. previous period
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-850 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">CRM Leads Generated</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {totalConversions.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 6.8% avg conversion rate
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-850 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Attributed Pipeline</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ${totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Direct downstream CRM value
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-850 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Average ROAS</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {avgRoas}×
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Return on Ad Spend
          </div>
        </div>
      </div>

      {/* Format Efficiency Matrix */}
      <div className="p-6 rounded-3xl border border-slate-850 bg-slate-900/60 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-bold text-white">Visual Format Conversion Efficiency</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {formatEfficiencies.map((eff) => (
            <div
              key={eff.format}
              className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{eff.format}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  RPM: ${eff.rpm}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-850">
                  <div className="text-[9px] text-slate-500">Impressions</div>
                  <div className="font-bold text-slate-200 font-mono mt-0.5">
                    {eff.totalImpressions.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-850">
                  <div className="text-[9px] text-slate-500">Conv Rate</div>
                  <div className="font-bold text-emerald-400 font-mono mt-0.5">
                    {eff.avgConversionRate}%
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-850">
                  <div className="text-[9px] text-slate-500">Revenue</div>
                  <div className="font-bold text-white font-mono mt-0.5">
                    ${eff.totalRevenue.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Attribution Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white">Active Campaign Attributions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp) => (
            <div
              key={camp.campaignId}
              className="p-5 rounded-3xl border border-slate-850 bg-slate-900/60 space-y-3 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-white">{camp.campaignName}</div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {camp.totalCreatives} Creatives
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850">
                  <div className="text-[10px] text-slate-500">Impressions</div>
                  <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                    {camp.totalImpressions.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850">
                  <div className="text-[10px] text-slate-500">Conversions</div>
                  <div className="text-xs font-bold text-purple-400 font-mono mt-0.5">
                    {camp.totalConversions.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850">
                  <div className="text-[10px] text-slate-500">Revenue</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                    ${camp.totalRevenue.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
