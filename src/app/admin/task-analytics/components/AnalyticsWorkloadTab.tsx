'use client';

/**
 * @fileOverview AnalyticsWorkloadTab component (Phase 4C).
 *
 * Implements:
 * - Workload distribution across team members.
 * - Highlights overdue burdens and active assignments.
 * - Clickable user cards with drill-down to /admin/tasks?assignee=[uid].
 * - Mobile-first layout with min-h-[44px] accessible touch targets.
 */

import * as React from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, CheckCircle2, ArrowUpRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TaskAnalyticsExtended } from '@/lib/analytics/task-analytics-service';
import type { UserProfile } from '@/lib/types';

export interface AnalyticsWorkloadTabProps {
  analytics: TaskAnalyticsExtended;
  teamMembers?: UserProfile[];
}

export function AnalyticsWorkloadTab({
  analytics,
  teamMembers = [],
}: AnalyticsWorkloadTabProps) {
  const userMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    teamMembers.forEach((u) => map.set(u.id, u));
    return map;
  }, [teamMembers]);

  if (analytics.userWorkload.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card">
        <Users className="h-10 w-10 text-muted-foreground/40 mb-2" />
        <h3 className="text-sm font-bold text-foreground">No assigned workload data</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Assigned tasks will populate team workload distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-figtree">
      <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <h3 className="text-sm font-bold text-foreground">Team Workload Distribution</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Active assignments, backlog density, and overdue tasks per member
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analytics.userWorkload.map((uw) => {
          const profile = userMap.get(uw.userId);
          const name = profile?.name || profile?.email || `User (${uw.userId.slice(0, 6)})`;

          return (
            <Link
              key={uw.userId}
              href={`/admin/tasks?assignee=${uw.userId}`}
              className="group block p-5 rounded-2xl border border-border/80 bg-card hover:border-border hover:shadow-md transition-all active:scale-[0.97] space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-xl border border-border/80">
                    <AvatarImage src={profile?.photoURL} alt={name} />
                    <AvatarFallback className="rounded-xl font-bold text-xs">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uw.totalAssigned} total assigned
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                <div className="p-2 rounded-xl bg-muted/30">
                  <p className="text-[11px] font-semibold text-muted-foreground">Open</p>
                  <p className="text-base font-black text-foreground mt-0.5">
                    {uw.openCount}
                  </p>
                </div>

                <div
                  className={`p-2 rounded-xl ${
                    uw.overdueCount > 0
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <p className="text-[11px] font-semibold">Overdue</p>
                  <p className="text-base font-black mt-0.5">{uw.overdueCount}</p>
                </div>

                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <p className="text-[11px] font-semibold">Done</p>
                  <p className="text-base font-black mt-0.5">{uw.completedCount}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
