'use client';

/**
 * @fileoverview "My Day" Unified Vertical Timeline Component (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Renders a vertical timeline of today's scheduled 1:1 appointments and group sessions.
 * - Powered by SSOT UnifiedMeetingItem domain model.
 * - Accurately highlights currently live sessions with pulsing real-time indicators.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Video,
  Radio,
  ArrowRight,
  Flame,
  Users,
  ExternalLink,
} from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { UnifiedMeetingItem } from '@/lib/meetings/types/unified-meeting';
import {
  isMeetingLiveNow,
  sortUnifiedMeetingsChronologically,
} from '@/lib/meetings/unified-meeting-service';
import { format } from 'date-fns';

export interface MyDayTimelineProps {
  items: UnifiedMeetingItem[];
  isLoading?: boolean;
  onOpenBookingDetail?: (bookingId: string) => void;
}

export function MyDayTimeline({
  items,
  isLoading = false,
  onOpenBookingDetail,
}: MyDayTimelineProps) {
  // Sort today's unified meetings chronologically
  const sortedItems = React.useMemo(() => {
    return sortUnifiedMeetingsChronologically(items, 'asc');
  }, [items]);

  const formatEventTime = (isoString: string) => {
    try {
      return format(new Date(isoString), 'p');
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <Card className="rounded-3xl border border-border/80 p-8 text-center space-y-3.5 bg-card/60">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">Your schedule is clear today</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No 1:1 consultations or group sessions scheduled for today. Share your booking links or create a new session.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Link href="/admin/meetings/event-types">
            <Button variant="outline" size="sm" className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97]">
              Share Booking Links <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Link href="/admin/meetings/new">
            <Button size="sm" className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-bold gap-1.5 active:scale-[0.97]">
              Schedule Session
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-border/80 shadow-xs bg-card">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            My Day Timeline
          </CardTitle>
          <CardInfoTooltip text="Today's chronological schedule including client appointments and live group sessions." />
        </div>
        <Badge variant="outline" className="text-[11px] font-bold text-primary bg-primary/10 border-primary/20">
          {sortedItems.length} Scheduled
        </Badge>
      </CardHeader>

      <CardContent className="p-6">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
          {sortedItems.map((item) => {
            const isCompleted = item.status === 'completed';
            const isCancelled = item.status === 'cancelled';
            const isLive = isMeetingLiveNow(item);
            const isBooking = item.sourceType === 'booking';
            const hasHighIntent =
              item.notes?.toLowerCase().includes('enterprise') ||
              item.notes?.toLowerCase().includes('urgent');

            return (
              <div key={item.id} className="relative group">
                {/* Timeline node marker */}
                <div
                  className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-background transition-colors ${
                    isLive
                      ? 'border-rose-500 bg-rose-500 ring-4 ring-rose-500/20 animate-pulse'
                      : isCompleted
                      ? 'border-emerald-500 bg-emerald-500'
                      : isCancelled
                      ? 'border-slate-400 bg-slate-400'
                      : 'border-primary group-hover:bg-primary'
                  }`}
                />

                {/* Event Card */}
                <div
                  className={`p-4 rounded-2xl border transition-colors space-y-2.5 ${
                    isLive
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 ring-1 ring-rose-400/30'
                      : isCancelled
                      ? 'border-border/60 bg-muted/10 opacity-70'
                      : 'border-border/70 bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatEventTime(item.startAt)} – {formatEventTime(item.endAt)}
                      </span>

                      {isLive && (
                        <Badge className="bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5" /> Live Now
                        </Badge>
                      )}

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isBooking
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/50'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/50'
                        }`}
                      >
                        {item.typeBadge || (isBooking ? '1:1 Booking' : 'Group Session')}
                      </Badge>

                      {hasHighIntent && (
                        <Badge className="text-[10px] font-bold bg-amber-500/10 text-amber-600 border-amber-200/50 gap-1">
                          <Flame className="w-3 h-3 fill-amber-500" /> High Intent
                        </Badge>
                      )}
                    </div>

                    <Badge
                      variant={isCompleted ? 'default' : isCancelled ? 'destructive' : 'secondary'}
                      className="text-[10px] font-bold capitalize w-fit"
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {isBooking ? (
                        <span>
                          {item.bookerName || 'Guest'} {item.bookerEmail ? `(${item.bookerEmail})` : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          <span>{item.participantCount} registered</span>
                          {item.hostName && <span>• Hosted by {item.hostName}</span>}
                        </span>
                      )}
                    </p>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1 bg-background/60 p-1.5 rounded-lg border border-border/40">
                      &quot;{item.notes}&quot;
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 capitalize">
                      <Video className="w-3 h-3 text-primary" />
                      {item.locationType.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-2">
                      {item.joinUrl && !isCancelled && (
                        <a href={item.joinUrl} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="sm"
                            className={`rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-bold gap-1 px-3 active:scale-[0.97] ${
                              isLive
                                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm ring-2 ring-rose-500/20'
                                : ''
                            }`}
                          >
                            <Video className="w-3 h-3" />
                            {isLive ? 'Join Room Now' : 'Join Call'}
                          </Button>
                        </a>
                      )}

                      {isBooking && onOpenBookingDetail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenBookingDetail(item.id)}
                          className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97]"
                        >
                          Details
                        </Button>
                      )}

                      {!isBooking && (
                        <Link href={`/admin/meetings/${item.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl min-h-[44px] sm:min-h-[32px] text-[11px] font-semibold text-muted-foreground hover:text-foreground gap-1 active:scale-[0.97]"
                          >
                            Manage <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
