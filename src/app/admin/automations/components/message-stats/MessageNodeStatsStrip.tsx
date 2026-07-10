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
  /** Render inside a card without wrapper borders/background/shadows. */
  integrated?: boolean;
}

/**
 * Compact delivery-stats strip rendered under a message step on the canvas.
 * Loads on mount and offers a manual refresh. Always visible so users can see
 * status initialized at 0 and trigger a manual refresh.
 */
export function MessageNodeStatsStrip({
  automationId,
  nodeId,
  channel,
  integrated = false,
}: MessageNodeStatsStripProps): React.ReactElement | null {
  const { stats, isLoading, isRefreshing, refresh } = useMessageNodeStats(automationId, nodeId);

  const [isLogsOpen, setIsLogsOpen] = React.useState(false);
  const [selectedMetric, setSelectedMetric] = React.useState('sent');

  if (isLoading) {
    if (integrated) {
      return <div className="h-4 w-full rounded bg-muted/30 animate-pulse" />;
    }
    return <div className="mt-1.5 h-[22px] w-64 rounded-md bg-muted/40 animate-pulse" />;
  }

  const resolvedChannel = stats?.channel ?? channel ?? 'email';
  const sent = stats?.sent ?? 0;
  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 100) : 0);

  const openLogs = (metric: string) => {
    setSelectedMetric(metric);
    setIsLogsOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          integrated
            ? "w-full h-full flex items-center justify-between gap-2 text-[9px]"
            : "mt-1.5 w-64 rounded-md border border-border/60 bg-card/90 backdrop-blur px-2 py-1 flex items-center justify-between gap-2 text-[9px] shadow-sm"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Stat label="Sent" value={sent} onClick={() => openLogs('sent')} />

          {resolvedChannel === 'email' ? (
            <>
              <Stat label="Open" value={stats?.opened ?? 0} pct={pct(stats?.opened ?? 0)} onClick={() => openLogs('opened')} />
              <Stat label="Click" value={stats?.clicked ?? 0} pct={pct(stats?.clicked ?? 0)} onClick={() => openLogs('clicked')} />
            </>
          ) : resolvedChannel === 'sms' ? (
            <>
              <Stat label="Deliv" value={stats?.delivered ?? 0} pct={pct(stats?.delivered ?? 0)} onClick={() => openLogs('delivered')} />
              <Stat
                label="Fail/Pend"
                value={sent - (stats?.delivered ?? 0)}
                pct={pct(sent - (stats?.delivered ?? 0))}
                onClick={() => openLogs('bounced')}
              />
            </>
          ) : (
            <>
              <Stat label="Deliv" value={stats?.delivered ?? 0} pct={pct(stats?.delivered ?? 0)} onClick={() => openLogs('delivered')} />
              <Stat label="Read" value={stats?.opened ?? 0} pct={pct(stats?.opened ?? 0)} onClick={() => openLogs('opened')} />
              <Stat label="Fail" value={stats?.failed ?? 0} pct={pct(stats?.failed ?? 0)} onClick={() => openLogs('bounced')} />
            </>
          )}

          {stats && stats.resent > 0 ? (
            <Stat label="Resent" value={stats.resent} onClick={() => openLogs('sent')} />
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void refresh();
          }}
          title="Refresh statistics"
          aria-label="Refresh statistics"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-all duration-150 ease-out active:scale-90 active:rotate-45"
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing ? 'animate-spin' : '')} />
        </button>
      </div>

      {automationId && (
        <MessageNodeLogsDialog
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          automationId={automationId}
          nodeId={nodeId}
          nodeLabel="Message Action"
          channel={resolvedChannel}
          initialTab={selectedMetric}
        />
      )}
    </>
  );
}

import { MessageNodeLogsDialog } from './MessageNodeLogsDialog';

function Stat({ 
  label, 
  value, 
  pct,
  onClick
}: { 
  label: string; 
  value: number; 
  pct?: number;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <span 
      className={cn(
        "flex items-center gap-0.5 whitespace-nowrap",
        onClick && "cursor-pointer hover:bg-muted/80 rounded px-1 -mx-0.5 transition-all text-primary/80 hover:text-primary"
      )}
      onClick={onClick}
    >
      <span className="text-muted-foreground/75 font-medium">{label}</span>
      <span className="font-bold text-foreground">
        {value}
        {typeof pct === 'number' ? (
          <span className="ml-0.5 font-normal text-muted-foreground/60">({pct}%)</span>
        ) : null}
      </span>
    </span>
  );
}

