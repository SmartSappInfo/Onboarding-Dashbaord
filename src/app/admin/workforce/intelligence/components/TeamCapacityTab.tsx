'use client';

/**
 * @fileOverview Team Utilization & Capacity Tab Component (Phase 11)
 *
 * Displays squad workload concentration, quota load meters, capacity ceilings,
 * and operational bottlenecks.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations and accessible progress meters.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import type { TeamIntelligenceSummary, TeamCapacityStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TeamCapacityTabProps {
  teams: TeamIntelligenceSummary[];
}

export function TeamCapacityTab({ teams }: TeamCapacityTabProps) {
  const statusBadge = (status: TeamCapacityStatus) => {
    switch (status) {
      case 'overloaded':
        return (
          <Badge variant="destructive" className="gap-1 text-[9px] font-bold uppercase tracking-wider">
            <Flame className="w-3 h-3" /> Overloaded
          </Badge>
        );
      case 'near_capacity':
        return (
          <Badge variant="outline" className="gap-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Near Capacity
          </Badge>
        );
      case 'optimal':
        return (
          <Badge variant="outline" className="gap-1 text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Optimal
          </Badge>
        );
      case 'under_utilized':
        return (
          <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">
            Under-Utilized
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold">Team Utilization & Operational Capacity</CardTitle>
              <CardDescription className="text-xs">
                Real-time workload balancing across departments and operational squads
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((t) => (
            <div
              key={t.teamId}
              className="p-4 border rounded-lg bg-card hover:bg-muted/10 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-foreground">{t.teamName}</h4>
                  <span className="text-[10px] text-muted-foreground">{t.departmentName}</span>
                </div>
                {statusBadge(t.status)}
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Workload Capacity</span>
                  <span className="font-bold font-mono text-foreground">{t.capacityPercent}%</span>
                </div>
                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      t.capacityPercent >= 90
                        ? 'bg-rose-500'
                        : t.capacityPercent >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(100, t.capacityPercent)}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs">
                <div className="p-2 bg-muted/20 rounded-md">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Members</span>
                  <span className="font-black text-foreground">{t.memberCount}</span>
                </div>
                <div className="p-2 bg-muted/20 rounded-md">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Pipeline</span>
                  <span className="font-black text-foreground">
                    ${(t.activePipelineValue / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="p-2 bg-muted/20 rounded-md">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Open Tasks</span>
                  <span className="font-black text-foreground">{t.openTasksCount}</span>
                </div>
              </div>

              {t.bottlenecks.length > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                  <span className="font-bold block">Bottleneck Warning:</span>
                  <ul className="list-disc list-inside">
                    {t.bottlenecks.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default TeamCapacityTab;
