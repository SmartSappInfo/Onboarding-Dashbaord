'use client';

/**
 * @fileOverview Standardized Activity Inspect Drawer (Phase 2 Milestone 3 - Task 4)
 *
 * Implements theme.md §8 Modal Architecture, Rule 4 (Strict Typing),
 * Rule 10 (Inline Architectural Documentation), Rule 39 (OpenTelemetry Distributed Tracing),
 * and Rule 41 ("Why did you do this?" Audit Trail).
 *
 * Architectural Invariants (§8 theme.md):
 *   1. Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
 *   2. Demarcated Header: `<DialogHeader demarcated>` (`min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5`).
 *   3. Zero Raw Descriptions: All contextual guidance routes through `<CardInfoTooltip text="..." />`.
 *   4. Screen-reader description: `<DialogDescription className="sr-only">`.
 *   5. Single-Circle Info Tooltip: elevated at `z-[10050]`.
 *   6. Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15` with tactile buttons (`rounded-xl active:scale-[0.97]`).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActorBadgeConfig } from './ActivityItem2';
import { Copy, Check, Hash, Activity as ActivityIcon, Network, Layers, FileJson } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface ActivityInspectDrawerProps {
  activity: ActivityRecordV2 | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityInspectDrawer({
  activity,
  open,
  onOpenChange,
}: ActivityInspectDrawerProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!activity) return null;

  const actorConfig = getActorBadgeConfig(activity.actor);
  const ActorIcon = actorConfig.icon;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast({ title: 'Copied', description: `Copied ${label} to clipboard.` });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({ title: 'Copy Failed', description: 'Failed to copy to clipboard.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="activity-inspect-drawer"
        className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header (§8.2 theme.md) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-primary" />
              <span>Event Audit & Trace Inspector</span>
            </DialogTitle>
            {/* Single-Circle Info Tooltip (§8.3 theme.md) */}
            <CardInfoTooltip text="Full event audit record, OpenTelemetry distributed tracing headers, actor attribution, and raw payload data." />
          </div>
          {/* Zero raw description: sr-only for WCAG AA (§8.2 theme.md) */}
          <DialogDescription className="sr-only">
            Detailed inspection drawer for event audit trails, causation links, and distributed trace headers.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm divide-y divide-border/40">
          {/* Section 1: Overview & Actor Attribution */}
          <div className="space-y-3 pt-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Actor & Summary</span>
            </h3>

            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${actorConfig.badgeClass}`}>
                    <ActorIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{activity.actor.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">ID: {activity.actor.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-xs ${actorConfig.badgeClass}`}>
                    {actorConfig.label}
                  </Badge>
                  {activity.actor.model && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {activity.actor.model}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Plain English Summary */}
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs font-medium text-muted-foreground mb-1">Human Summary:</p>
                <p className="text-sm font-normal text-foreground bg-background/60 p-2.5 rounded-lg border border-border/40">
                  {activity.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Entity Reference */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              <span>Target Entity</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border/60 bg-muted/10">
                <span className="text-muted-foreground">Entity Type:</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{activity.entity.type}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/60 bg-muted/10">
                <span className="text-muted-foreground">Entity ID:</span>
                <p className="font-mono font-medium text-foreground mt-0.5 truncate">{activity.entity.id}</p>
              </div>
              {activity.entity.name && (
                <div className="sm:col-span-2 p-3 rounded-lg border border-border/60 bg-muted/10">
                  <span className="text-muted-foreground">Entity Label:</span>
                  <p className="font-medium text-foreground mt-0.5">{activity.entity.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: OpenTelemetry Distributed Tracing (Rule 39 & 41) */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" />
              <span>Distributed Tracing Context</span>
            </h3>

            <div className="space-y-2.5 font-mono text-xs">
              {/* Correlation ID */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                <div className="min-w-0 pr-2">
                  <span className="text-muted-foreground font-sans text-[11px] block">Correlation ID (Trace):</span>
                  <span className="text-foreground truncate block">{activity.correlationId}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(activity.correlationId, 'Correlation ID')}
                  className="h-8 w-8 p-0 rounded-lg shrink-0 active:scale-95"
                  aria-label="Copy Correlation ID"
                >
                  {copiedKey === 'Correlation ID' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Causation ID */}
              {activity.causationId && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="min-w-0 pr-2">
                    <span className="text-muted-foreground font-sans text-[11px] block">Causation ID:</span>
                    <span className="text-foreground truncate block">{activity.causationId}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activity.causationId!, 'Causation ID')}
                    className="h-8 w-8 p-0 rounded-lg shrink-0 active:scale-95"
                    aria-label="Copy Causation ID"
                  >
                    {copiedKey === 'Causation ID' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}

              {/* Event ID */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                <div className="min-w-0 pr-2">
                  <span className="text-muted-foreground font-sans text-[11px] block">Event ID:</span>
                  <span className="text-foreground truncate block">{activity.eventId}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(activity.eventId, 'Event ID')}
                  className="h-8 w-8 p-0 rounded-lg shrink-0 active:scale-95"
                  aria-label="Copy Event ID"
                >
                  {copiedKey === 'Event ID' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Section 4: Raw Structured Payload (JSON) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileJson className="h-3.5 w-3.5" />
                <span>Payload Data & Details</span>
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(activity.details, null, 2), 'Payload JSON')}
                className="h-7 px-2 text-xs flex items-center gap-1 rounded-md active:scale-95 text-muted-foreground"
              >
                {copiedKey === 'Payload JSON' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>Copy JSON</span>
              </Button>
            </div>

            <pre className="p-3.5 rounded-xl border border-border/80 bg-muted/40 font-mono text-xs overflow-x-auto max-h-56 leading-relaxed text-foreground/90">
              {JSON.stringify(activity.details, null, 2)}
            </pre>
          </div>
        </div>

        {/* Demarcated Footer Bar (§8.5 theme.md) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 active:scale-[0.97] transition-transform min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
