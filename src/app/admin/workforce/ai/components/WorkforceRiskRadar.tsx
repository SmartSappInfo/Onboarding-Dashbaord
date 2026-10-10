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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { ShieldAlert, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import type { OrganizationRiskOverview } from '@/lib/types';

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
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground">Average Workforce Risk</CardTitle>
              <CardInfoTooltip text="Aggregated multi-factor workforce risk score across toxic roles, dormant admin access, and over-privilege." />
            </div>
            <Sparkles className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-foreground">{overview.averageScore}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  overview.averageScore < 30
                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : overview.averageScore < 60
                    ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    : 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                }`}
              >
                {overview.averageScore < 30
                  ? 'Low Risk'
                  : overview.averageScore < 60
                  ? 'Medium Risk'
                  : 'High Risk'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Critical Risk Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground">Critical Vulnerabilities</CardTitle>
              <CardInfoTooltip text="Members holding toxic separation of duties (SoD) pairings or dormant admin privileges." />
            </div>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-rose-600">{overview.criticalRiskCount}</div>
          </CardContent>
        </Card>

        {/* High Risk Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground">High Over-Privilege</CardTitle>
              <CardInfoTooltip text="Members with less than 20% permission usage over the past 90 days." />
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-amber-600">{overview.highRiskCount}</div>
          </CardContent>
        </Card>

        {/* Low Risk / Compliant Count */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground">Least-Privilege Compliant</CardTitle>
              <CardInfoTooltip text="Right-sized access profiles adhering to least-privilege zero-trust standards." />
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-emerald-600">{overview.lowRiskCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Risk Exposure Summary */}
      <Card className="border bg-card shadow-xs p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-foreground">Principal Exposure Drivers</h3>
            <CardInfoTooltip text="Dominant risk categories identified across workforce scans." />
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
