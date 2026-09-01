'use client';

/**
 * @fileOverview Workforce Adoption & Engagement Overview (Analytics 2.0)
 *
 * Displays high-level adoption KPIs (DAU/MAU, 30-day retention, active tiers)
 * with responsive cards and Emil Kowalski spring easing.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix & Tailwind styling with zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Sparkles, Moon, Activity, CheckCircle2 } from 'lucide-react';
import type { OrganizationAdoptionSummary, MemberActivityMetric } from '@/lib/types';

interface AdoptionMetricsOverviewProps {
  summary: OrganizationAdoptionSummary | null;
  memberMetrics: MemberActivityMetric[];
  isLoading: boolean;
}

export function AdoptionMetricsOverview({
  summary,
  memberMetrics,
  isLoading,
}: AdoptionMetricsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 border bg-card/60 animate-pulse space-y-3">
            <div className="h-4 w-1/3 bg-muted/40 rounded" />
            <div className="h-8 w-1/2 bg-muted/40 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  const highlyActive = summary?.highlyActiveCount || 0;
  const active = summary?.activeCount || 0;
  const dormant = summary?.dormantCount || 0;
  const inactive = summary?.inactiveCount || 0;
  const total = summary?.totalMembers || 1;

  const highlyActivePct = Math.round((highlyActive / total) * 100);
  const activePct = Math.round((active / total) * 100);
  const dormantPct = Math.round((dormant / total) * 100);
  const inactivePct = Math.round((inactive / total) * 100);

  return (
    <div className="space-y-6">
      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">DAU / MAU Stickiness</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{Math.round((summary?.dauMauRatio || 0) * 100)}%</div>
            <p className="text-[11px] text-muted-foreground">
              {summary?.dau || 0} Daily Active / {summary?.mau || 0} Monthly Active
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Total Workforce</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{summary?.totalMembers || 0}</div>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {highlyActive + active} actively collaborating
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Onboarding Velocity</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{summary?.onboardingCompletionRate || 0}%</div>
            <p className="text-[11px] text-muted-foreground">Across active member journeys</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">MFA Adoption</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-black text-foreground">{summary?.mfaAdoptionPercent || 0}%</div>
            <p className="text-[11px] text-muted-foreground">Members with verified MFA</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Status Distribution Bar */}
      <Card className="border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold">Workforce Engagement Distribution</CardTitle>
          <CardDescription className="text-xs">
            Dynamic activity categorization replacing static &quot;last active&quot; timestamps
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="h-3 w-full rounded-full bg-muted/30 overflow-hidden flex">
            <div style={{ width: `${highlyActivePct}%` }} className="bg-emerald-500 h-full" title={`Highly Active: ${highlyActive}`} />
            <div style={{ width: `${activePct}%` }} className="bg-blue-500 h-full" title={`Active: ${active}`} />
            <div style={{ width: `${dormantPct}%` }} className="bg-amber-500 h-full" title={`Dormant: ${dormant}`} />
            <div style={{ width: `${inactivePct}%` }} className="bg-rose-500 h-full" title={`Inactive: ${inactive}`} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-foreground">{highlyActive} ({highlyActivePct}%)</span>
                <span className="text-[11px] text-muted-foreground block">Highly Active (24h)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <div>
                <span className="font-bold text-foreground">{active} ({activePct}%)</span>
                <span className="text-[11px] text-muted-foreground block">Active (7d)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-foreground">{dormant} ({dormantPct}%)</span>
                <span className="text-[11px] text-muted-foreground block">Dormant (8-30d)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              <div>
                <span className="font-bold text-foreground">{inactive} ({inactivePct}%)</span>
                <span className="text-[11px] text-muted-foreground block">Inactive (30d+)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdoptionMetricsOverview;
