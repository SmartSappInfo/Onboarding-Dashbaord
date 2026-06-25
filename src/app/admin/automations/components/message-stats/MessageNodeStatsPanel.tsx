'use client';

import * as React from 'react';
import { RefreshCw, BarChart3, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMessageNodeStats } from './useMessageNodeStats';

interface MessageNodeStatsPanelProps {
  automationId: string | undefined;
  nodeId: string;
  /** Fallback channel when no stats document exists yet. */
  channel?: 'email' | 'sms' | 'whatsapp';
}

/**
 * Full delivery-statistics view for the inspector's "Statistics" tab. Loads on
 * mount, refreshes on demand, and adapts the metric set to the channel (email
 * shows engagement; SMS shows delivery/failure only).
 */
export function MessageNodeStatsPanel({
  automationId,
  nodeId,
  channel,
}: MessageNodeStatsPanelProps): React.ReactElement {
  const { stats, isLoading, isRefreshing, error, refresh } = useMessageNodeStats(automationId, nodeId);

  const isUnsaved = !automationId || automationId === 'new';
  const resolvedChannel = stats?.channel ?? channel ?? 'email';
  const isEmail = resolvedChannel === 'email';
  const sent = stats?.sent ?? 0;
  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 100) : 0);

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          Delivery Statistics
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-[10px]"
          onClick={() => void refresh()}
          disabled={isRefreshing || isLoading || isUnsaved}
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {isUnsaved ? (
        <EmptyState message="Save the automation and let it run to see delivery statistics." />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : !stats || sent === 0 ? (
        <EmptyState message="No messages have been sent from this step yet." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Sent" value={sent} />
            <StatCard label="Delivered" value={stats.delivered} sub={`${pct(stats.delivered)}%`} tone="info" />
            {isEmail && <StatCard label="Opened" value={stats.opened} sub={`${pct(stats.opened)}%`} tone="success" />}
            {isEmail && <StatCard label="Clicked" value={stats.clicked} sub={`${pct(stats.clicked)}%`} tone="success" />}
            {isEmail ? (
              <StatCard label="Bounced" value={stats.bounced} sub={`${pct(stats.bounced)}%`} tone="danger" />
            ) : (
              <StatCard label="Undelivered" value={stats.failed} sub={`${pct(stats.failed)}%`} tone="danger" />
            )}
            {isEmail && <StatCard label="Complaints" value={stats.complained} tone="danger" />}
            {isEmail && <StatCard label="Unsubscribed" value={stats.unsubscribed} tone="danger" />}
            {stats.resent > 0 && <StatCard label="Resent" value={stats.resent} tone="warning" />}
          </div>

          {stats.lastMessageAt && (
            <p className="text-[10px] text-muted-foreground">
              Last message {new Date(stats.lastMessageAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

type StatTone = 'default' | 'info' | 'success' | 'danger' | 'warning';

const TONE_CLASS: Record<StatTone, string> = {
  default: 'border-border/60 bg-card',
  info: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20',
  success: 'border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20',
  danger: 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
  warning: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
};

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: StatTone;
}): React.ReactElement {
  return (
    <div className={cn('rounded-lg border p-2.5', TONE_CLASS[tone])}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold leading-tight text-foreground">
        {value}
        {sub && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{sub}</span>}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center">
      <BarChart3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </div>
  );
}
