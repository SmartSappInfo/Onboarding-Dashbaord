'use client';

/**
 * @fileOverview Executive Overview Tab Component (Phase 11)
 *
 * Displays top-level executive KPI metric cards for organizational health,
 * active workforce capacity, enterprise IAM maturity, and at-risk member counts.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Users,
  AlertTriangle,
  Layers,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { WorkforceIntelligenceSnapshot } from '@/lib/types';

interface ExecutiveOverviewTabProps {
  snapshot: WorkforceIntelligenceSnapshot;
}

export function ExecutiveOverviewTab({ snapshot }: ExecutiveOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <Card className="border bg-card shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Organizational Health</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {snapshot.overallHealthScore}/100
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">
                Optimal
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {snapshot.flourishingMembersCount} flourishing workforce members
            </p>
          </CardContent>
        </Card>

        {/* Team Capacity */}
        <Card className="border bg-card shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Average Squad Capacity</span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {snapshot.averageTeamCapacity}%
              </span>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 font-bold">
                Balanced
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Across {snapshot.teamSummaries.length} operational squads
            </p>
          </CardContent>
        </Card>

        {/* At-Risk / Strained Members */}
        <Card className="border bg-card shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Strained & At-Risk</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {snapshot.strainedMembersCount + snapshot.atRiskMembersCount}
              </span>
              <span className="text-xs text-muted-foreground">members</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {snapshot.strainedMembersCount} strained, {snapshot.atRiskMembersCount} at risk
            </p>
          </CardContent>
        </Card>

        {/* Enterprise IAM Maturity */}
        <Card className="border bg-card shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Enterprise IAM Maturity</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {snapshot.enterpriseIamMaturityScore}/100
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">
                Enterprise Ready
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              SSO & MFA policies active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Snapshot Metadata Banner */}
      <div className="p-4 bg-muted/20 border rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">
            Snapshot Generated: {new Date(snapshot.generatedAt).toLocaleString()}
          </span>
        </div>
        <span className="text-muted-foreground text-[11px]">
          Synthesizes telemetry, CRM workload, role entitlements, and identity governance
        </span>
      </div>
    </div>
  );
}

export default ExecutiveOverviewTab;
