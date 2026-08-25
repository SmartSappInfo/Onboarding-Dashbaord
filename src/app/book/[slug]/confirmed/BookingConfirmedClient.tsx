'use client';

/**
 * @fileoverview Booking Confirmed Client Component (Meetings 2.0).
 * Displays celebratory confirmation screen with formatted meeting schedule,
 * join links, 1-click Google/Outlook calendar sync, .ics download, and reschedule/cancel options.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  Globe,
  Download,
  CalendarPlus,
  ArrowRight,
  User,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Booking, EventType } from '@/lib/meetings/types';
import { AddToCalendarDropdown } from '@/components/shared/AddToCalendarDropdown';
import {
  generateIcsContent,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from '@/lib/meetings/ics-helpers';

interface BookingConfirmedClientProps {
  booking: Booking;
  eventType: EventType | null;
  manageToken: string;
  slug: string;
}

export default function BookingConfirmedClient({
  booking,
  eventType,
  manageToken,
  slug,
}: BookingConfirmedClientProps) {
  const startDate = new Date(booking.startAt);
  const endDate = new Date(booking.endAt);

  const googleCalUrl = React.useMemo(() => {
    return getGoogleCalendarUrl({
      title: `${booking.eventTypeName} - SmartSapp`,
      description: `Meeting with ${booking.booker?.firstName} ${booking.booker?.lastName}.\nJoin Link: ${booking.joinUrl || ''}`,
      location: booking.joinUrl || 'Online',
      startAt: booking.startAt,
      endAt: booking.endAt,
    });
  }, [booking]);

  const outlookCalUrl = React.useMemo(() => {
    return getOutlookCalendarUrl({
      title: `${booking.eventTypeName} - SmartSapp`,
      description: `Meeting with ${booking.booker?.firstName} ${booking.booker?.lastName}.\nJoin Link: ${booking.joinUrl || ''}`,
      location: booking.joinUrl || 'Online',
      startAt: booking.startAt,
      endAt: booking.endAt,
    });
  }, [booking]);

  // Trigger .ics file download
  const handleDownloadIcs = () => {
    const icsString = generateIcsContent({
      title: `${booking.eventTypeName} - SmartSapp`,
      description: `Meeting with ${booking.booker?.firstName} ${booking.booker?.lastName}.\nJoin Link: ${booking.joinUrl || ''}`,
      location: booking.joinUrl || 'Online',
      startAt: booking.startAt,
      endAt: booking.endAt,
      attendeeName: `${booking.booker?.firstName} ${booking.booker?.lastName}`.trim(),
      attendeeEmail: booking.booker?.email,
    });

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `invite-${booking.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12">
      <Card className="w-full max-w-xl rounded-3xl border border-border shadow-xl overflow-hidden bg-card text-center">
        {/* Top Header Banner */}
        <div className="p-8 pb-6 bg-primary/5 flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">You are scheduled!</h1>
            <p className="text-xs text-muted-foreground mt-1">
              A calendar invitation has been sent to <strong>{booking.booker?.email}</strong>.
            </p>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6 text-left">
          {/* Summary Box */}
          <div className="p-5 rounded-2xl border border-border bg-card/60 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">{booking.eventTypeName}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5" />
                {booking.booker?.firstName} {booking.booker?.lastName}
              </p>
            </div>

            <Separator />

            <div className="space-y-2.5 text-xs text-foreground font-medium">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {format(startDate, 'h:mm a')} – {format(endDate, 'h:mm a')} ({booking.timezone})
                </span>
              </div>

              {booking.joinUrl && (
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-primary shrink-0" />
                  <a
                    href={booking.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold break-all"
                  >
                    {booking.joinUrl}
                  </a>
                </div>
              )}
            </div>

            {eventType?.confirmationMessage && (
              <div className="p-3.5 rounded-xl bg-muted/40 text-xs text-muted-foreground border border-border/60">
                {eventType.confirmationMessage}
              </div>
            )}
          </div>

          {/* Calendar Sync Buttons */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">
              Add to Your Calendar
            </h3>

            <div className="flex justify-center">
              <AddToCalendarDropdown
                event={{
                  title: eventType?.name || 'Scheduled Meeting',
                  description: eventType?.description,
                  startAt: booking.startAt,
                  endAt: booking.endAt,
                  location: booking.joinUrl || undefined,
                  meetingUrl: booking.joinUrl || undefined,
                }}
              />
            </div>
          </div>

          {/* Self-Service Reschedule & Cancel Links */}
          <div className="border-t border-border pt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Need to make changes?</span>
            <div className="flex items-center gap-3">
              <Link
                href={`/book/${slug}/reschedule/${booking.id}${manageToken ? `?token=${manageToken}` : ''}`}
                className="inline-flex items-center gap-1 hover:text-foreground font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reschedule
              </Link>
              <span>•</span>
              <Link
                href={`/book/${slug}/cancel/${booking.id}${manageToken ? `?token=${manageToken}` : ''}`}
                className="inline-flex items-center gap-1 hover:text-destructive font-medium transition-colors"
              >
                <XCircle className="w-3 h-3" /> Cancel
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
