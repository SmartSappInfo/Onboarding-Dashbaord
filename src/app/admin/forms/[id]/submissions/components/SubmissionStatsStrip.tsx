'use client';

import * as React from 'react';
import { TrendingUp, Calendar, CalendarDays, LinkIcon } from 'lucide-react';
import type { SubmissionStats } from '@/lib/forms-utils';

interface Props {
  stats: SubmissionStats;
}

const statCards = [
  { key: 'total',              label: 'Total',         icon: TrendingUp,   colorClass: 'text-primary',   bgClass: 'bg-primary/5' },
  { key: 'thisWeek',          label: 'This Week',     icon: Calendar,     colorClass: 'text-sky-500',   bgClass: 'bg-sky-500/5' },
  { key: 'thisMonth',         label: 'This Month',    icon: CalendarDays, colorClass: 'text-violet-500', bgClass: 'bg-violet-500/5' },
  { key: 'entityResolvedPct', label: 'CRM Resolved',  icon: LinkIcon,     colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/5' },
] as const;

export default function SubmissionStatsStrip({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map(({ key, label, icon: Icon, colorClass, bgClass }) => (
        <div
          key={key}
          className="rounded-2xl border border-border/40 bg-card p-5 flex items-center gap-4"
        >
          <div className={`p-2.5 rounded-xl ${bgClass} shrink-0`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold font-mono tracking-tight mt-0.5">
              {stats[key as keyof SubmissionStats]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
