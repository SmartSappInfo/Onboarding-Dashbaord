'use client';

/**
 * @fileOverview Right Sidebar Active Queues Widget.
 * 
 * Part of SmartSapp Communications Hub (Phase 5).
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Tabular nums across all counts to eliminate CLS.
 * - Rule 4: Strict typing, zero any.
 * - Rule 7: Everyday UI English, min-h-[44px] touch targets, active:scale-[0.98].
 * - Rule 8: Safe relative routing.
 * - Rule 25: Exposes dead-letter and pending queues directly with alert highlights.
 */

import * as React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ActiveQueueStats } from '@/lib/types/messaging-dashboard';

export interface ActiveQueuesCardProps {
  stats?: ActiveQueueStats;
  isLoading?: boolean;
  className?: string;
}

export function ActiveQueuesCard({ stats, isLoading, className }: ActiveQueuesCardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    );
  }

  const failedCount = stats?.failedCount ?? 0;

  const items = [
    {
      id: 'scheduled',
      label: 'Scheduled Messages',
      count: stats?.scheduledCount ?? 0,
      href: '/admin/messaging/scheduled',
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-border/60 hover:border-primary/40',
      isAlert: false,
    },
    {
      id: 'pending',
      label: 'Pending Approval',
      count: stats?.pendingApprovalCount ?? 0,
      href: '/admin/messaging/jobs',
      icon: CheckCircle2,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-border/60 hover:border-primary/40',
      isAlert: false,
    },
    {
      id: 'failed',
      label: 'Failed Deliveries',
      count: failedCount,
      href: '/admin/messaging/jobs?status=failed',
      icon: AlertTriangle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: failedCount > 0 ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60' : 'border-border/60 hover:border-primary/40',
      isAlert: failedCount > 0,
    },
  ];

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
              Active Queues
            </h3>
            <CardInfoTooltip text="Operational message pipeline including scheduled, pending approval, and failed dispatches." />
          </div>
        </div>
        <Link
          href="/admin/messaging/scheduled"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all shrink-0"
        >
          Manage queue <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'min-h-[44px] p-2.5 rounded-xl border bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]',
              item.border
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', item.bg, item.color)}>
                <item.icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
                {item.isAlert && (
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">
                    Needs Attention
                  </span>
                )}
              </div>
            </div>
            <span
              className={cn(
                'text-xs font-bold tabular-nums px-2 py-0.5 rounded-md',
                item.isAlert
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                  : 'bg-muted/40 text-foreground'
              )}
            >
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
