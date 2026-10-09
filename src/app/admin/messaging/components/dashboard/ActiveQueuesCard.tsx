'use client';

/**
 * @fileOverview Right Sidebar Active Queues Widget.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Tabular nums across all counts to eliminate CLS.
 * - Rule 4: Strict typing, zero any.
 * - Rule 7: Everyday UI English, min-h-[44px] touch targets.
 * - Rule 8: Safe relative routing.
 * - Rule 25: Exposes dead-letter and pending queues directly.
 */

import * as React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
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
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const items = [
    { label: 'Scheduled Messages', count: stats?.scheduledCount ?? 0, href: '/admin/messaging/scheduled', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Pending Approval', count: stats?.pendingApprovalCount ?? 0, href: '/admin/messaging/jobs', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Failed Deliveries', count: stats?.failedCount ?? 0, href: '/admin/messaging/jobs?status=failed', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Active Queues</h3>
          <p className="text-xs text-muted-foreground">Operational queue pipeline</p>
        </div>
        <Link href="/admin/messaging/scheduled" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
          Manage queue <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', item.bg, item.color)}>
                <item.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{item.label}</span>
            </div>
            <span className="text-xs font-bold text-foreground tabular-nums px-2 py-0.5 rounded-md bg-muted/40">
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
