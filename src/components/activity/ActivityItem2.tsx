'use client';

/**
 * @fileOverview Standardized Activity Item Component 2.0 (Phase 2 Milestone 3 - Task 3)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Visual Clarity & Everyday English),
 * Rule 10 (Inline Architectural Documentation), Rule 16 (Actor Classes & Attribution),
 * Emil Kowalski Motion Principles (active:scale-[0.97]), and Mobile 44px Touch Targets.
 *
 * Renders an immutable ActivityRecordV2 item with:
 *   - Visual actor categorization badges (👤 Human, 🤖 AI, ⚡ Automation, ⚙️ System).
 *   - Everyday plain English summaries without raw code jargon.
 *   - Interactive "Inspect" button opening the theme.md §8 Inspect Drawer.
 *   - Accessible ARIA labels and minimum 44px touch targets.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import type { ActivityRecordV2, NormalizedActor } from '@/platform/events/contracts/activity-record.contract';
import { User, Sparkles, Zap, Settings2, Clock, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ActivityItem2Props {
  activity: ActivityRecordV2;
  onInspect?: (activity: ActivityRecordV2) => void;
  className?: string;
}

/**
 * Returns the visual badge styling, icon, and label based on normalized actor type (Rule 16).
 */
export function getActorBadgeConfig(actor: NormalizedActor): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeClass: string;
} {
  switch (actor.type) {
    case 'agent':
      return {
        icon: Sparkles,
        label: actor.agentRole ? `AI (${actor.agentRole})` : 'AI Agent',
        badgeClass:
          'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/80',
      };
    case 'automation':
      return {
        icon: Zap,
        label: 'Automation',
        badgeClass:
          'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80',
      };
    case 'system':
      return {
        icon: Settings2,
        label: 'System',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
      };
    case 'user':
    default:
      return {
        icon: User,
        label: 'User',
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80',
      };
  }
}

/**
 * Formats ISO timestamp into readable time and relative description.
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function ActivityItem2({
  activity,
  onInspect,
  className,
}: ActivityItem2Props) {
  const actorConfig = getActorBadgeConfig(activity.actor);
  const ActorIcon = actorConfig.icon;

  return (
    <div
      data-testid={`activity-item-${activity.id}`}
      className={cn(
        'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-card text-card-foreground hover:bg-muted/10 transition-colors',
        className
      )}
    >
      {/* Left side: Actor Avatar/Icon, Summary, and Entity reference */}
      <div className="flex items-start gap-3.5 min-w-0">
        {/* Visual Actor Icon Bubble */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm',
            actorConfig.badgeClass
          )}
          aria-hidden="true"
        >
          <ActorIcon className="h-5 w-5" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Actor Name */}
            <span className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[200px]">
              {activity.actor.displayName}
            </span>

            {/* Actor Class Badge (Rule 16) */}
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0',
                actorConfig.badgeClass
              )}
            >
              <ActorIcon className="h-3 w-3" />
              {actorConfig.label}
            </Badge>

            {/* Entity Badge */}
            {activity.entity?.type && (
              <Badge
                variant="secondary"
                className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border-border/60 shrink-0"
              >
                {activity.entity.type}: {activity.entity.name || activity.entity.id}
              </Badge>
            )}
          </div>

          {/* Plain English Summary (Rule 7) */}
          <p className="text-sm text-foreground/90 font-normal leading-relaxed break-words">
            {activity.summary}
          </p>
        </div>
      </div>

      {/* Right side: Timestamp & Inspect Action Button */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        {/* Time display */}
        <div className="flex items-center text-xs text-muted-foreground gap-1.5 font-mono">
          <Clock className="h-3.5 w-3.5" />
          <time dateTime={activity.timestamp}>{formatTime(activity.timestamp)}</time>
        </div>

        {/* Inspect Drawer Trigger Button (Emil Kowalski feedback, min-h-[44px]) */}
        {onInspect && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onInspect(activity)}
            aria-label={`Inspect event ${activity.eventId}`}
            className="h-10 min-h-[44px] px-3.5 rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/40 text-muted-foreground hover:text-foreground font-medium text-xs active:scale-[0.97] transition-all flex items-center gap-1.5"
          >
            <Eye className="h-4 w-4" />
            <span>Inspect</span>
          </Button>
        )}
      </div>
    </div>
  );
}
