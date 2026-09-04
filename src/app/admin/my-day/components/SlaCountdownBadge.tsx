'use client';

/**
 * @fileoverview Live SLA Countdown Badge Component (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 30 & UI Section 16:
 * - Live client-side interval ticker (updates every 60s without refetching).
 * - Dynamic color transitions: Emerald (on_track), Amber (at_risk <= 2h), Rose (breached).
 * - Accessible, high-contrast badges for mobile and desktop.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strict typing with zero 'any'.
 * - Intervals must be cleaned up on unmount to prevent memory leaks.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { evaluateSlaTiming } from '@/lib/seller-workspace/priority-engine';
import type { SlaStatus } from '@/lib/seller-workspace/types';

interface SlaCountdownBadgeProps {
  dueDate: string;
  status?: SlaStatus;
  className?: string;
}

export function SlaCountdownBadge({ dueDate, status, className = '' }: SlaCountdownBadgeProps) {
  const [timing, setTiming] = React.useState(() => evaluateSlaTiming(dueDate));

  React.useEffect(() => {
    // 60-second update interval
    const interval = setInterval(() => {
      setTiming(evaluateSlaTiming(dueDate));
    }, 60000);

    return () => clearInterval(interval);
  }, [dueDate]);

  const activeSlaStatus = status || timing.slaStatus;
  const { badgeLabel } = timing;

  if (activeSlaStatus === 'breached') {
    return (
      <Badge
        variant="destructive"
        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 ${className}`}
      >
        <AlertCircle className="h-3 w-3 shrink-0" />
        {badgeLabel}
      </Badge>
    );
  }

  if (activeSlaStatus === 'at_risk') {
    return (
      <Badge
        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {badgeLabel}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`rounded-lg px-2 py-0.5 text-[10px] font-medium font-mono flex items-center gap-1 text-muted-foreground border-border/40 ${className}`}
    >
      <Clock className="h-2.5 w-2.5 shrink-0" />
      {badgeLabel}
    </Badge>
  );
}
