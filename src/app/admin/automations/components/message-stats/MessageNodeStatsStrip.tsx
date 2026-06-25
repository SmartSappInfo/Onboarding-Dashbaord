'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessageNodeStats } from './useMessageNodeStats';

interface MessageNodeStatsStripProps {
  automationId: string | undefined;
  nodeId: string;
  /** Fallback channel when no stats document exists yet. */
  channel?: 'email' | 'sms' | 'whatsapp';
}

/**
 * Compact delivery-stats strip rendered under a message step on the canvas.
 * Loads on mount and offers a manual refresh. Stays hidden until the node has
 * actually sent something, so unused message steps don't add visual noise.
 */
export function MessageNodeStatsStrip({
  automationId,
  nodeId,
  channel,
}: MessageNodeStatsStripProps): React.ReactElement | null {
  const { stats, isLoading, isRefreshing, refresh } = useMessageNodeStats(automationId, nodeId);

  if (isLoading) {
    return <div className="mt-1.5 h-[22px] w-64 rounded-md bg-muted/40 animate-pulse" />;
  }

  const sent = stats?.sent ?? 0;
  if (!stats || sent === 0) return null;

  const isEmail = (stats.channel ?? channel ?? 'email') === 'email';
  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 100) : 0);

  return (
    <div
      className="mt-1.5 w-64 rounded-md border border-border/60 bg-card/90 backdrop-blur px-2 py-1 flex items-center justify-between gap-2 text-[9px] shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <Stat label="Sent" value={sent} />
        <Stat label="Deliv" value={stats.delivered} pct={pct(stats.delivered)} />
        {isEmail ? (
          <>
            <Stat label="Open" value={stats.opened} pct={pct(stats.opened)} />
            <Stat label="Bounce" value={stats.bounced} pct={pct(stats.bounced)} />
          </>
        ) : (
          <Stat label="Fail" value={stats.failed} pct={pct(stats.failed)} />
        )}
        {stats.resent > 0 && <Stat label="Resent" value={stats.resent} />}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void refresh();
        }}
        title="Refresh statistics"
        aria-label="Refresh statistics"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
      </button>
    </div>
  );
}

function Stat({ label, value, pct }: { label: string; value: number; pct?: number }): React.ReactElement {
  return (
    <span className="flex items-center gap-0.5 whitespace-nowrap">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-semibold text-foreground">
        {value}
        {typeof pct === 'number' && <span className="ml-0.5 font-normal text-muted-foreground/60">({pct}%)</span>}
      </span>
    </span>
  );
}
