'use client';

/**
 * @fileoverview Slide-over Booking Detail Drawer (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Provides fast inspection of attendee details, CRM links, and quick actions without navigating away.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CalendarCheck,
  Clock,
  Video,
  User,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  Calendar,
  XCircle,
  FileText,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { Booking } from '@/lib/meetings/types';

interface BookingDetailDrawerProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
}

export function BookingDetailDrawer({
  booking,
  open,
  onOpenChange,
  onReschedule,
  onCancel,
}: BookingDetailDrawerProps) {
  if (!booking) return null;

  const startDate = new Date(booking.startAt);
  const endDate = new Date(booking.endAt);
  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';

  const formatFullDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeRange = (start: Date, end: Date) => {
    const s = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const e = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${s} – ${e}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <Badge
              variant={isCompleted ? 'default' : isCancelled ? 'destructive' : 'secondary'}
              className="text-xs font-bold capitalize"
            >
              {booking.status}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">{booking.timezone}</span>
          </div>

          <SheetTitle className="text-lg font-bold text-foreground">
            {booking.eventTypeName || 'Scheduled Consultation'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {formatFullDate(startDate)} • {formatTimeRange(startDate, endDate)}
          </SheetDescription>
        </SheetHeader>

        {/* Join Meeting Action Banner */}
        {booking.joinUrl && !isCancelled && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-primary flex items-center gap-1.5 capitalize">
                <Video className="w-4 h-4" /> {booking.locationType.replace('_', ' ')}
              </span>
            </div>
            <a href={booking.joinUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full rounded-xl min-h-[40px] text-xs font-bold gap-2 active:scale-[0.97]">
                <Video className="w-4 h-4" /> Join Video Call
              </Button>
            </a>
          </div>
        )}

        <Separator />

        {/* Attendee / Booker Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" /> Attendee Details
          </h4>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {booking.booker.firstName} {booking.booker.lastName}
              </span>
            </div>

            {booking.booker.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <a href={`mailto:${booking.booker.email}`} className="hover:text-primary transition-colors">
                  {booking.booker.email}
                </a>
              </div>
            )}

            {booking.booker.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <a href={`tel:${booking.booker.phone}`} className="hover:text-primary transition-colors">
                  {booking.booker.phone}
                </a>
              </div>
            )}

            {booking.booker.notes && (
              <div className="pt-2 border-t border-border/40 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Intake Notes
                </span>
                <p className="text-xs text-foreground/90 italic bg-card p-2 rounded-xl border border-border/40">
                  &quot;{booking.booker.notes}&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* CRM Context Card */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-primary" /> CRM Context & Deal
          </h4>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-foreground">
              <span>{booking.booker.firstName}&apos;s Organization</span>
              <Badge variant="outline" className="text-[10px] font-bold text-primary bg-primary/10">
                Lead
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Opportunity: Enterprise Expansion • Stage: Discovery
            </p>
            <div className="pt-2">
              <Link href="/admin/deals">
                <Button variant="outline" size="sm" className="w-full rounded-xl text-xs font-semibold gap-1.5 h-8">
                  View Full CRM Record <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Controls */}
        <SheetFooter className="flex flex-col gap-2 pt-2 sm:space-x-0">
          <Link href={`/admin/meetings/${booking.id}`} className="w-full">
            <Button variant="default" className="w-full rounded-xl min-h-[42px] text-xs font-bold gap-2 active:scale-[0.97]">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" /> Open Intelligence Dossier
            </Button>
          </Link>

          {!isCancelled && !isCompleted && (
            <div className="grid grid-cols-2 gap-2 w-full">
              {onReschedule && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReschedule(booking)}
                  className="rounded-xl h-9 text-xs font-semibold active:scale-[0.97]"
                >
                  Reschedule
                </Button>
              )}
              {onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(booking)}
                  className="rounded-xl h-9 text-xs font-semibold text-destructive hover:bg-destructive/10 active:scale-[0.97]"
                >
                  Cancel Meeting
                </Button>
              )}
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
