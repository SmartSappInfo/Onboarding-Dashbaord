'use client';

/**
 * SmartSapp Forms 2.0: Response Center Status Distribution Strip
 * 
 * Displays key submission qualification counts (Total, New, Qualified, Converted, High Score)
 * with 1-click filter activation.
 */

import React from 'react';
import { Inbox, Sparkles, CheckCircle2, UserCheck, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormSubmission } from '@/lib/types';
import type { SubmissionStatus } from '@/lib/forms/form-response-types';

interface ResponseCenterStatsProps {
  submissions: FormSubmission[];
  activeStatus: SubmissionStatus | 'all';
  onSelectStatus: (status: SubmissionStatus | 'all') => void;
}

export default function ResponseCenterStats({
  submissions = [],
  activeStatus,
  onSelectStatus,
}: ResponseCenterStatsProps) {
  const totalCount = submissions.length;
  const newCount = submissions.filter(s => !s.status || s.status === 'new').length;
  const qualifiedCount = submissions.filter(s => s.status === 'qualified').length;
  const convertedCount = submissions.filter(s => s.status === 'converted').length;
  const highScoreCount = submissions.filter(s => (s.totalScore || 0) >= 50).length;

  const stats = [
    {
      id: 'all',
      label: 'All Responses',
      count: totalCount,
      icon: Inbox,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      id: 'new',
      label: 'New Intake',
      count: newCount,
      icon: Sparkles,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
    {
      id: 'qualified',
      label: 'Qualified Leads',
      count: qualifiedCount,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    {
      id: 'converted',
      label: 'Converted',
      count: convertedCount,
      icon: UserCheck,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      id: 'high_score',
      label: 'High Lead Score (≥50)',
      count: highScoreCount,
      icon: Flame,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((item) => {
        const Icon = item.icon;
        const isSelected = activeStatus === item.id || (item.id === 'all' && activeStatus === 'all');

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectStatus(item.id as SubmissionStatus | 'all')}
            className={cn(
              "text-left p-3.5 rounded-2xl border transition-all duration-200 min-h-[44px] flex items-center justify-between",
              isSelected
                ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-sm"
                : "bg-card/50 border-border/60 hover:bg-card hover:border-border"
            )}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground block truncate">
                {item.label}
              </span>
              <div className="text-xl font-extrabold tracking-tight text-foreground">
                {item.count.toLocaleString()}
              </div>
            </div>

            <div className={cn("p-2 rounded-xl shrink-0", item.bgColor)}>
              <Icon className={cn("h-4 w-4", item.color)} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
