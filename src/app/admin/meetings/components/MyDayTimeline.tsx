'use client';

/**
 * @fileoverview "My Day" Vertical Timeline Component (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Renders a vertical timeline of today's scheduled meetings.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Video,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type { Booking } from '@/lib/meetings/types';

interface MyDayTimelineProps {
  bookings: Booking[];
  onOpenBookingDetail?: (booking: Booking) => void;
}

export function MyDayTimeline({ bookings, onOpenBookingDetail }: MyDayTimelineProps) {
  // Sort today's bookings chronologically
  const sortedBookings = React.useMemo(() => {
    return [...bookings].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }, [bookings]);

  if (sortedBookings.length === 0) {
    return (
      <Card className="rounded-3xl border border-border/80 p-8 text-center space-y-3 bg-card/60">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">Your schedule is clear today</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No meetings scheduled for today. Share your public booking link or schedule a new appointment.
          </p>
        </div>
        <Link href="/admin/meetings/event-types">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 mt-2">
            Share Booking Links <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </Card>
    );
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="rounded-3xl border border-border/80 shadow-xs bg-card">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            My Day Timeline
          </CardTitle>
          <p className="text-xs text-muted-foreground">Today&apos;s chronological schedule and sessions</p>
        </div>
        <Badge variant="outline" className="text-[11px] font-bold text-primary bg-primary/10 border-primary/20">
          {sortedBookings.length} Scheduled
        </Badge>
      </CardHeader>

      <CardContent className="p-6">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
          {sortedBookings.map((bkg, index) => {
            const isCompleted = bkg.status === 'completed';
            const isCancelled = bkg.status === 'cancelled';
            const hasHighIntent = bkg.booker.notes?.toLowerCase().includes('enterprise') || bkg.booker.notes?.toLowerCase().includes('urgent');

            return (
              <div key={bkg.id} className="relative group">
                {/* Timeline node marker */}
                <div
                  className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-background transition-colors ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500'
                      : isCancelled
                      ? 'border-rose-500 bg-rose-500'
                      : 'border-primary group-hover:bg-primary'
                  }`}
                />

                {/* Event Card */}
                <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatTime(bkg.startAt)} – {formatTime(bkg.endAt)}
                      </span>
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
                      {bkg.status}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground hover:text-primary transition-colors">
                      {bkg.eventTypeName || 'Scheduled Consultation'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {bkg.booker.firstName} {bkg.booker.lastName} {bkg.booker.email ? `(${bkg.booker.email})` : ''}
                    </p>
                  </div>

                  {bkg.booker.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1 bg-background/60 p-1.5 rounded-lg border border-border/40">
                      &quot;{bkg.booker.notes}&quot;
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 capitalize">
                      <Video className="w-3 h-3 text-primary" />
                      {bkg.locationType.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-2">
                      {bkg.joinUrl && !isCancelled && (
                        <a href={bkg.joinUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="rounded-xl h-7 text-[11px] font-bold gap-1 px-2.5 active:scale-[0.97]">
                            <Video className="w-3 h-3" /> Join Call
                          </Button>
                        </a>
                      )}
                      {onOpenBookingDetail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenBookingDetail(bkg)}
                          className="rounded-xl h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          Details
                        </Button>
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
