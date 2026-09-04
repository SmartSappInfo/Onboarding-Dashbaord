'use client';

/**
 * @fileoverview Command Center Tab (Tab 1) for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 38 & UI Sections 39-40:
 * 1. High-Priority Operational Attention Cards: Real-time triage of critical pipeline anomalies.
 * 2. Rep Health & Operational Capacity Matrix: Live visibility into individual sales rep workloads,
 *    composite performance indexes, and quota pacing.
 * 3. At-Risk Deals Table: Triage table identifying stalled/disengaged high-value opportunities
 *    with 1-click manager elevation into Phase 2 "DO THIS NOW".
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile responsive: cards on small viewports, high-density table on desktop.
 * - Interactive elements must provide minimum 44px touch targets.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Flame,
  UserCheck,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import type {
  AttentionItem,
  RepWorkloadSummary,
  AtRiskDeal,
  ManagerInterventionType,
} from '@/lib/manager-command/types';

interface CommandCenterTabProps {
  attentionItems: AttentionItem[];
  reps: RepWorkloadSummary[];
  atRiskDeals: AtRiskDeal[];
  onTriggerIntervention: (params: {
    targetDeal?: AtRiskDeal;
    targetRep?: RepWorkloadSummary;
    defaultType?: ManagerInterventionType;
  }) => void;
  onSelectRepForCoaching: (repId: string) => void;
  onNavigateToWorkload: () => void;
}

export function CommandCenterTab({
  attentionItems,
  reps,
  atRiskDeals,
  onTriggerIntervention,
  onSelectRepForCoaching,
  onNavigateToWorkload,
}: CommandCenterTabProps) {
  const [dealFilter, setDealFilter] = React.useState<'all' | 'critical' | 'elevated'>('all');

  const filteredDeals = React.useMemo(() => {
    if (dealFilter === 'critical') return atRiskDeals.filter((d) => d.riskScore >= 70);
    if (dealFilter === 'elevated') return atRiskDeals.filter((d) => d.isManagerElevated);
    return atRiskDeals;
  }, [atRiskDeals, dealFilter]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Operational Attention Cards (UI Section 40) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Immediate Operational Attention
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-destructive/30 text-destructive">
              {attentionItems.length} Alerts
            </Badge>
          </div>
        </div>

        {attentionItems.length === 0 ? (
          <Card className="rounded-2xl border border-dashed p-6 text-center bg-card/40">
            <p className="text-xs text-muted-foreground">
              No critical operational anomalies detected. Pipeline and workload distribution are healthy.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {attentionItems.map((item) => {
              const isCritical = item.severity === 'critical';
              return (
                <Card
                  key={item.id}
                  className={`rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md ${
                    isCritical
                      ? 'border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card'
                      : 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card'
                  }`}
                >
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={isCritical ? 'destructive' : 'secondary'}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                      >
                        {item.severity}
                      </Badge>
                      {item.dealValue ? (
                        <span className="text-xs font-mono font-bold text-foreground">
                          GHS {item.dealValue.toLocaleString()}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>

                    {item.repName && (
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span>Owner: <strong className="text-foreground">{item.repName}</strong></span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/30">
                      <Button
                        size="sm"
                        variant={isCritical ? 'default' : 'outline'}
                        onClick={() => {
                          if (item.interventionType === 'schedule_coaching' && item.repId) {
                            onSelectRepForCoaching(item.repId);
                          } else if (item.interventionType === 'reassign' && !item.dealId) {
                            onNavigateToWorkload();
                          } else {
                            const deal = atRiskDeals.find((d) => d.id === item.dealId);
                            const rep = reps.find((r) => r.userId === item.repId);
                            onTriggerIntervention({
                              targetDeal: deal,
                              targetRep: rep,
                              defaultType: item.interventionType,
                            });
                          }
                        }}
                        className="w-full min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97] transition-all"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Rep Health & Operational Capacity Matrix */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Sales Representative Health & Capacity Matrix
            </h3>
            <p className="text-xs text-muted-foreground">
              Live capacity utilization, Phase 2 queue load, and composite performance index.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToWorkload}
            className="min-h-[44px] sm:min-h-[32px] text-xs font-semibold rounded-xl gap-1.5 active:scale-[0.97]"
          >
            <span>Workload Workbench</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {reps.map((rep) => {
            const isOverloaded = rep.workloadStatus === 'overloaded';
            const isOptimal = rep.workloadStatus === 'optimal';

            return (
              <Card
                key={rep.userId}
                className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-4 hover:border-primary/30 transition-all duration-200"
              >
                {/* Header Profile */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {rep.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {rep.userName}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate">{rep.role}</p>
                    </div>
                  </div>

                  <Badge
                    variant={isOverloaded ? 'destructive' : isOptimal ? 'outline' : 'secondary'}
                    className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      isOptimal ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : ''
                    }`}
                  >
                    {rep.workloadStatus}
                  </Badge>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">Capacity Utilization</span>
                    <span className="font-mono font-bold text-foreground">
                      {rep.capacityUtilizationPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isOverloaded
                          ? 'bg-destructive'
                          : isOptimal
                          ? 'bg-emerald-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(rep.capacityUtilizationPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats Matrix */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center bg-muted/30 rounded-xl p-2.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block">Deals</span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {rep.activeDealsCount} / {rep.maxOpenDeals}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block">Queue Items</span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {rep.activeQueueItemsCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block">Scorecard</span>
                    <span className="text-xs font-mono font-bold text-primary">
                      {rep.performanceIndex} pts
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectRepForCoaching(rep.userId)}
                    className="min-h-[44px] sm:min-h-[34px] rounded-xl text-[11px] font-semibold gap-1 active:scale-[0.97]"
                  >
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>1:1 Coaching</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onTriggerIntervention({
                        targetRep: rep,
                        defaultType: isOverloaded ? 'reassign' : 'add_guidance',
                      })
                    }
                    className="min-h-[44px] sm:min-h-[34px] rounded-xl text-[11px] font-semibold gap-1 active:scale-[0.97]"
                  >
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    <span>Intervene</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. At-Risk Deals Table */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>At-Risk & Stalled Pipeline Opportunities</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Deals stalled in stage or lacking engagement signals. Elevate to inject directly into rep&apos;s Phase 2 top priority slot.
              </CardDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={dealFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setDealFilter('all')}
                className="h-8 min-h-[36px] px-2.5 rounded-lg text-xs"
              >
                All ({atRiskDeals.length})
              </Button>
              <Button
                size="sm"
                variant={dealFilter === 'critical' ? 'default' : 'ghost'}
                onClick={() => setDealFilter('critical')}
                className="h-8 min-h-[36px] px-2.5 rounded-lg text-xs"
              >
                Critical Risk
              </Button>
              <Button
                size="sm"
                variant={dealFilter === 'elevated' ? 'default' : 'ghost'}
                onClick={() => setDealFilter('elevated')}
                className="h-8 min-h-[36px] px-2.5 rounded-lg text-xs"
              >
                Hero Elevated
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredDeals.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No at-risk deals matching the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-muted-foreground">Deal Name</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Value</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Assigned Rep</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Stage</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Days Stalled</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Risk Attribution</TableHead>
                    <TableHead className="text-xs font-semibold text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((deal) => (
                    <TableRow key={deal.id} className="border-border/30 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          {deal.isManagerElevated && (
                            <Badge variant="default" className="bg-primary text-[9px] px-1 py-0 gap-0.5">
                              <Flame className="h-2.5 w-2.5" /> HERO
                            </Badge>
                          )}
                          <span className="truncate max-w-[180px] sm:max-w-none">{deal.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        GHS {deal.value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {deal.assignedRepName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal border-border/60">
                          {deal.stageName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-mono font-bold ${
                            deal.daysInCurrentStage >= 14 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {deal.daysInCurrentStage} days
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {deal.riskReasons.map((r, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md truncate"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onTriggerIntervention({
                              targetDeal: deal,
                              defaultType: 'elevate_to_hero',
                            })
                          }
                          className="h-8 min-h-[44px] sm:min-h-[32px] rounded-lg text-xs font-semibold gap-1 active:scale-[0.97]"
                        >
                          <Flame className="h-3 w-3 text-primary" />
                          <span>Intervene</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
