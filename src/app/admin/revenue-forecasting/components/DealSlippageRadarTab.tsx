'use client';

/**
 * @fileoverview Deal Close-Date Slippage Velocity Radar Tab (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. Tracks close-date push velocity and delays across quarterly boundaries.
 * 2. Classifies slippage into severity tiers: Critical, High, Moderate, Low.
 * 3. Quantifies slip velocity metrics (slipCount * daysSlipped / 30).
 * 4. Contextual AI mitigation plays for sales management intervention.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile ergonomics: min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Compass,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import type {
  DealSlippageModel,
  RevenueForecastOverview,
  SlippageSeverity,
} from '@/lib/revenue-forecasting/types';

interface DealSlippageRadarTabProps {
  overview: RevenueForecastOverview;
}

export function DealSlippageRadarTab({ overview }: DealSlippageRadarTabProps) {
  const { slippageRadar } = overview;
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');

  const filteredRadar = React.useMemo(() => {
    return slippageRadar.filter((deal) => {
      if (severityFilter === 'all') return true;
      return deal.severity === severityFilter;
    });
  }, [slippageRadar, severityFilter]);

  // Aggregate metrics
  const totalSlippedCount = slippageRadar.filter((d) => d.slipCount > 0).length;
  const totalSlippedValue = slippageRadar
    .filter((d) => d.slipCount > 0)
    .reduce((acc, d) => acc + d.dealValue, 0);

  const pastQuarterEndCount = slippageRadar.filter((d) => d.isPushedPastQuarterEnd).length;
  const criticalCount = slippageRadar.filter((d) => d.severity === 'critical').length;

  const getSeverityBadge = (severity: SlippageSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
            Critical Severity
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
            High Severity
          </Badge>
        );
      case 'moderate':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold">
            Moderate
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold">
            Low / Stable
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Slipped Opportunities
          </span>
          <div className="text-2xl font-black text-foreground mt-1">
            {totalSlippedCount} Deals
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pushed at least once from original date
          </p>
        </Card>

        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Delayed Pipeline Value
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            GHS {totalSlippedValue.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            At-risk revenue in pushed deals
          </p>
        </Card>

        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Pushed Past Quarter End
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {pastQuarterEndCount} Deals
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Delayed into subsequent fiscal period
          </p>
        </Card>

        <Card className="border-border/50 rounded-2xl p-4 bg-card shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Critical Intervention Queue
          </span>
          <div className="text-2xl font-black text-foreground mt-1">
            {criticalCount} Deals
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Requiring immediate executive sponsor check-in
          </p>
        </Card>
      </div>

      {/* 2. Slippage Radar Table & AI Recommended Playbook */}
      <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b pb-4 px-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              Close-Date Slippage Velocity Radar ({filteredRadar.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Deals exhibiting repeat close-date pushbacks and delay velocity that threaten revenue predictability.
            </p>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs font-bold rounded-xl border px-3 py-1.5 bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Severity Only</option>
              <option value="high">High Severity</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low / Stable</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Opportunity & Rep</th>
                  <th className="py-3.5 px-4 font-bold">Value</th>
                  <th className="py-3.5 px-4 font-bold">Original Date</th>
                  <th className="py-3.5 px-4 font-bold">Current Date</th>
                  <th className="py-3.5 px-4 font-bold">Delay Velocity</th>
                  <th className="py-3.5 px-4 font-bold">Severity</th>
                  <th className="py-3.5 px-4 font-bold">AI Mitigation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRadar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No deals match the selected severity tier.
                    </td>
                  </tr>
                ) : (
                  filteredRadar.map((item) => (
                    <tr key={item.dealId} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">{item.dealName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.ownerName} • {item.stageName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-black text-foreground">
                        GHS {item.dealValue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(item.originalCloseDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {new Date(item.currentCloseDate).toLocaleDateString()}
                        </div>
                        {item.isPushedPastQuarterEnd && (
                          <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                            Pushed past quarter
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          +{item.daysSlipped} Days ({item.slipCount}x)
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Velocity: {item.slipVelocity}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getSeverityBadge(item.severity)}</td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-1.5 text-[11px] text-foreground/90 font-medium">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{item.recommendedMitigation}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
