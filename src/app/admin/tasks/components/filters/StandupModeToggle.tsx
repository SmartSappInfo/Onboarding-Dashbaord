'use client';

/**
 * StandupModeToggle - Agile Standup Mode Segmented Control
 *
 * Allows users to toggle between Normal Triage Mode (Overdue -> Upcoming -> Completed)
 * and Standup Mode (Completed -> Upcoming -> Overdue).
 * When active on a Monday, renders an informative indicator: "Monday Standup: Reviewing Fri – Mon work".
 *
 * @rule Rule 1: Clean architecture
 * @rule Rule 4: Strict Typing (Zero any/any[])
 * @rule Rule 7: Mobile-first & min-h-[44px] touch targets
 */

import * as React from 'react';
import { Briefcase, Mic, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { isMondayDate, type TaskTriageMode } from '@/lib/tasks/task-triage-filter-engine';

export interface StandupModeToggleProps {
  mode: TaskTriageMode;
  onModeChange: (mode: TaskTriageMode) => void;
  anchorDate?: Date;
  className?: string;
}

export function StandupModeToggle({
  mode,
  onModeChange,
  anchorDate = new Date(),
  className,
}: StandupModeToggleProps) {
  const isMonday = React.useMemo(() => isMondayDate(anchorDate), [anchorDate]);
  const isStandup = mode === 'standup';

  return (
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center gap-2', className)}>
      {/* Segmented Control Container */}
      <div
        role="group"
        aria-label="Task display mode"
        className="inline-flex items-center p-1 rounded-xl bg-muted/50 border border-border/80 shadow-2xs"
      >
        <button
          type="button"
          onClick={() => onModeChange('normal')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold h-11 min-h-[44px] transition-all active:scale-[0.97]',
            !isStandup
              ? 'bg-background text-foreground shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
          aria-pressed={!isStandup}
        >
          <Briefcase className={cn('h-3.5 w-3.5', !isStandup ? 'text-primary' : 'text-muted-foreground')} />
          <span>Normal</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('standup')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold h-11 min-h-[44px] transition-all active:scale-[0.97]',
            isStandup
              ? 'bg-primary text-primary-foreground shadow-xs border border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
          aria-pressed={isStandup}
        >
          <Mic className={cn('h-3.5 w-3.5', isStandup ? 'text-primary-foreground' : 'text-muted-foreground')} />
          <span>Standup Mode</span>
        </button>
      </div>

      {/* Monday Twist Indicator Pill */}
      {isStandup && isMonday && (
        <Badge
          variant="outline"
          className="h-8 px-2.5 rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-[11px] flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200"
        >
          <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
          <span>Monday Standup: Reviewing Fri – Mon work</span>
        </Badge>
      )}
    </div>
  );
}
