'use client';

/**
 * @fileOverview Workforce Risk Radar Component (Phase 8)
 *
 * Displays multi-factor composite risk distribution across organization members
 * with high-risk exposure alerts and score breakdowns.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Cards and Emil Kowalski spring easing.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, ShieldCheck, TrendingDown, Sparkles } from 'lucide-react';
import type { OrganizationRiskOverview } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WorkforceRiskRadarProps {
  overview: OrganizationRiskOverview | null;
  isLoading: boolean;
}

export function WorkforceRiskRadar({ overview, isLoading }: WorkforceRiskRadarProps) {
  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted/30 border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Risk Gauge */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Average Workforce Risk</CardTitle>
            <Sparkles className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">{overview.averageScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {overview.averageScore < 30
                ? 'Healthy posture (Low Risk)'
                : overview.averageScore < 60
                ? 'Moderate exposure (Medium Risk)'
                : 'Elevated vulnerability (High Risk)'}
            </p>
          </CardContent>
        </Card>

        {/* Critical Risk Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Critical Vulnerabilities</CardTitle>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-3xl font-black text-rose-600">{overview.criticalRiskCount}</div>
            <p className="text-[11px] text-muted-foreground">Members holding toxic SoD or dormant admin</p>
          </CardContent>
        </Card>

        {/* High Risk Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">High Over-Privilege</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-3xl font-black text-amber-600">{overview.highRiskCount}</div>
            <p className="text-[11px] text-muted-foreground">Members with &lt;20% 90d permission usage</p>
          </CardContent>
        </Card>

        {/* Low Risk / Compliant Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Least-Privilege Compliant</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-3xl font-black text-emerald-600">{overview.lowRiskCount}</div>
            <p className="text-[11px] text-emerald-600 font-semibold">Right-sized access profiles</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Risk Exposure Summary */}
      <Card className="border bg-card shadow-xs p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-foreground">Principal Exposure Drivers</h3>
            <p className="text-[11px] text-muted-foreground">Dominant risk categories identified across workforce scans</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {overview.topRiskFactors.map((f, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] py-0.5 px-2 font-medium">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default WorkforceRiskRadar;
