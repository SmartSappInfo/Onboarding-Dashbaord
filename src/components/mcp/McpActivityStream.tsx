'use client';

/**
 * @fileOverview Real-Time MCP Activity Stream (Phase 5 Milestone 4 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 40: Append-only audit trail presentation.
 * - Rule 62: Live SSE reactivity via useEventStream.
 * - Rule 14 & 15: Security alert visualization for tool drift and supply-chain events.
 */

import * as React from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  Check,
  Radio,
} from 'lucide-react';

export interface McpActivityStreamProps {
  workspaceId?: string | null;
  maxItems?: number;
}

export interface McpStreamEventItem {
  id: string;
  eventType: string;
  timestamp: string;
  actor: string;
  summary: string;
  details?: Record<string, unknown>;
  correlationId?: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

const INITIAL_MOCK_EVENTS: McpStreamEventItem[] = [
  {
    id: 'evt_init_1',
    eventType: 'mcp.tool.executed',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    actor: 'lead_sdr',
    summary: 'Capability crm.activity.create executed successfully (duration: 32ms)',
    status: 'success',
    correlationId: 'corr_mcp_9a2f1b80',
  },
  {
    id: 'evt_init_2',
    eventType: 'mcp.security.fingerprint_approved',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actor: 'usr_admin',
    summary: 'Fingerprint approved for capability crm.contact.create v1.0.0',
    status: 'info',
    correlationId: 'corr_mcp_31c8901e',
  },
  {
    id: 'evt_init_3',
    eventType: 'mcp.server.status_changed',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actor: 'system',
    summary: 'External MCP server srv_weather_gateway transitioned: tested -> approved',
    status: 'info',
    correlationId: 'corr_mcp_77e02914',
  },
];

export function McpActivityStream({
  workspaceId,
  maxItems = 50,
}: McpActivityStreamProps) {
  const [events, setEvents] = React.useState<McpStreamEventItem[]>(INITIAL_MOCK_EVENTS);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const { status: streamStatus } = useEventStream({
    workspaceId: workspaceId || undefined,
    enabled: Boolean(workspaceId),
    onActivity: (activity: ActivityRecordV2) => {
      // Only capture MCP and security events
      if (
        activity.eventType.startsWith('mcp.') ||
        activity.eventType.startsWith('policy.') ||
        activity.eventType.startsWith('governance.')
      ) {
        let status: McpStreamEventItem['status'] = 'info';
        if (
          activity.eventType.includes('failed') ||
          activity.eventType.includes('blocked') ||
          activity.eventType.includes('drift_detected')
        ) {
          status = activity.eventType.includes('drift') ? 'warning' : 'error';
        } else if (
          activity.eventType.includes('executed') ||
          activity.eventType.includes('approved')
        ) {
          status = 'success';
        }

        const newEvent: McpStreamEventItem = {
          id: activity.id,
          eventType: activity.eventType,
          timestamp: activity.timestamp,
          actor: activity.actor.displayName || activity.actor.id,
          summary: activity.summary,
          details: activity.details,
          correlationId: activity.correlationId,
          status,
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, maxItems));
      }
    },
  });

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: McpStreamEventItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      default:
        return <Activity className="h-4 w-4 text-primary shrink-0" />;
    }
  };

  const formatEventBadge = (eventType: string) => {
    if (eventType.includes('drift')) {
      return (
        <Badge variant="destructive" className="font-mono text-[10px] uppercase">
          Drift Detected
        </Badge>
      );
    }
    if (eventType.includes('exfiltration_blocked')) {
      return (
        <Badge variant="destructive" className="font-mono text-[10px] uppercase">
          Exfiltration Blocked
        </Badge>
      );
    }
    if (eventType.includes('executed')) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-mono text-[10px] uppercase">
          Tool Executed
        </Badge>
      );
    }
    if (eventType.includes('approved')) {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-mono text-[10px] uppercase">
          Approved
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {eventType}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {/* Stream Control Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Live MCP Activity Stream</h3>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span
              className={`h-2 w-2 rounded-full ${
                streamStatus === 'connected'
                  ? 'bg-emerald-500'
                  : streamStatus === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-muted-foreground/40'
              }`}
            />
            <span className="capitalize">{streamStatus}</span>
          </span>
        </div>

        {events.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEvents([])}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 active:scale-[0.97]"
          >
            <Trash2 className="h-3 w-3" />
            Clear Feed
          </Button>
        )}
      </div>

      {/* Events Container */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm divide-y divide-border/60 max-h-[480px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <Activity className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
            <p>No activity events recorded yet. Waiting for live tool execution...</p>
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className="p-3.5 sm:p-4 hover:bg-muted/10 transition-colors flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5">{getStatusIcon(evt.status)}</div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {formatEventBadge(evt.eventType)}
                    <span className="text-[11px] text-muted-foreground">
                      by <span className="font-mono font-medium text-foreground">{evt.actor}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-foreground/90 font-medium leading-relaxed truncate-2-lines">
                    {evt.summary}
                  </p>
                </div>
              </div>

              {evt.correlationId && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(evt.id, evt.correlationId!)}
                    title={`Copy correlation ID: ${evt.correlationId}`}
                    className="font-mono text-[10px] text-muted-foreground hover:text-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/60 flex items-center gap-1 active:scale-[0.97]"
                  >
                    <span className="truncate max-w-[80px]">{evt.correlationId.slice(0, 12)}...</span>
                    {copiedId === evt.id ? (
                      <Check className="h-2.5 w-2.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
