'use client';

/**
 * {{Org_name}} Experience Platform — Event Countdown Badge
 *
 * Real-time dynamic session status and countdown indicator with
 * tactile Emil Kowalski pulsing indicators and zero layout shift.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { getEventLiveCountdown, type LiveCountdownState } from '@/lib/utils/event-calendar-utils';
import { Radio, Clock } from 'lucide-react';

interface EventCountdownBadgeProps {
  scheduledStartTime: string;
  scheduledEndTime: string;
  className?: string;
}

export function EventCountdownBadge({
  scheduledStartTime,
  scheduledEndTime,
  className,
}: EventCountdownBadgeProps) {
  const [countdown, setCountdown] = React.useState<LiveCountdownState>(() =>
    getEventLiveCountdown(scheduledStartTime, scheduledEndTime)
  );

  React.useEffect(() => {
    // Immediate compute
    setCountdown(getEventLiveCountdown(scheduledStartTime, scheduledEndTime));

    const interval = setInterval(() => {
      setCountdown(getEventLiveCountdown(scheduledStartTime, scheduledEndTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledStartTime, scheduledEndTime]);

  if (countdown.isLive) {
    return (
      <Badge
        className={`bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] gap-1.5 px-2.5 py-0.5 shadow-sm animate-pulse ${className || ''}`}
      >
        <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping" />
        <Radio className="w-3 h-3" />
        <span>LIVE NOW</span>
      </Badge>
    );
  }

  if (countdown.isPast) {
    return (
      <Badge
        variant="secondary"
        className={`bg-muted text-muted-foreground font-semibold text-[10px] px-2 py-0.5 ${className || ''}`}
      >
        <span>Ended</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`bg-primary/5 text-primary border-primary/20 font-bold text-[10px] gap-1 px-2.5 py-0.5 ${className || ''}`}
    >
      <Clock className="w-3 h-3" />
      <span>{countdown.label}</span>
    </Badge>
  );
}
