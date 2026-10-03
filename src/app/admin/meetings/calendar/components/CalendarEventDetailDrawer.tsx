'use client';

/**
 * @fileoverview Slide-over Calendar Event Detail Drawer (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Provides immediate inspection of any calendar event on the grid without navigation away.
 * - Conforms to Standardized Modal Architecture in theme.md (demarcated header, CardInfoTooltip, sr-only description).
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
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Video,
  User,
  Mail,
  Copy,
  ExternalLink,
  Radio,
  Share2,
  Calendar,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { CalendarGridEvent } from '@/lib/meetings/types/calendar-view';
import { isMeetingLiveNow } from '@/lib/meetings/unified-meeting-service';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export interface CalendarEventDetailDrawerProps {
  event: CalendarGridEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarEventDetailDrawer({
  event,
  open,
  onOpenChange,
}: CalendarEventDetailDrawerProps) {
  const { toast } = useToast();

  if (!event) return null;

  const isLive = isMeetingLiveNow(event.startAt, event.endAt);
  const isExternal = !!event.isExternalCollision;
  const is1to1 = !!(event.contactName || event.contactEmail);

  const durationMinutes = Math.max(
    1,
    Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000)
  );

  const formattedDate = (() => {
    try {
      return format(new Date(event.startAt), 'EEEE, MMMM d, yyyy');
    } catch {
      return event.startAt;
    }
  })();

  const formattedTimeRange = (() => {
    try {
      return `${format(new Date(event.startAt), 'p')} – ${format(new Date(event.endAt), 'p')}`;
    } catch {
      return '';
    }
  })();

  const handleCopyJoinLink = () => {
    if (!event.joinUrl) return;
    navigator.clipboard.writeText(event.joinUrl);
    toast({
      title: 'Link Copied! 🔗',
      description: 'Video room meeting link copied to clipboard.',
    });
  };

  const handleCopyShareLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/meetings/session/${event.sourceId || event.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Share Link Copied! 🔗',
      description: 'Public session registration link copied to clipboard.',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto p-0 flex flex-col justify-between">
        {/* Demarcated Header */}
        <div>
          <SheetHeader className="p-6 border-b border-border/80 bg-muted/20 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <SheetTitle className="text-base font-bold text-foreground truncate">
                  {event.title}
                </SheetTitle>
                <CardInfoTooltip text="Detailed event information, participant roster, and quick actions." />
              </div>
            </div>
            <SheetDescription className="sr-only">
              Detailed event metadata and participant actions for {event.title}
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-5">
            {/* Live Indicator Banner */}
            {isLive && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-300 dark:border-rose-900/60 flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">Session Is Live Now</span>
                </div>
                {event.joinUrl && (
                  <a href={event.joinUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl min-h-[44px] sm:min-h-[32px] text-xs font-bold active:scale-[0.97]"
                    >
                      Join Room
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isExternal
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50'
                    : is1to1
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/50'
                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/50'
                }`}
              >
                {isExternal
                  ? 'External Calendar Block'
                  : is1to1
                  ? '1:1 Consultation'
                  : 'Group Broadcast / Webinar'}
              </Badge>

              {event.status && (
                <Badge
                  variant={
                    event.status === 'completed'
                      ? 'default'
                      : event.status === 'cancelled'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-[11px] font-bold capitalize"
                >
                  {event.status}
                </Badge>
              )}
            </div>

            {/* Schedule & Timing Card */}
            <div className="p-4 rounded-2xl border border-border/80 bg-muted/15 space-y-2">
              <div className="flex items-center gap-2.5 text-xs text-foreground font-semibold">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  {formattedTimeRange} ({durationMinutes} mins)
                </span>
              </div>
            </div>

            {/* Host & Platform Card */}
            <div className="p-4 rounded-2xl border border-border/80 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">
                      {event.hostName || 'Workspace Host'}
                    </h5>
                    <p className="text-[11px] text-muted-foreground">Session Host</p>
                  </div>
                </div>

                {event.locationType && (
                  <Badge variant="outline" className="text-[10px] font-semibold capitalize gap-1">
                    <Video className="w-3 h-3 text-primary" />
                    {event.locationType.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Attendee / Registrant Details */}
            {is1to1 && (event.contactName || event.contactEmail) && (
              <div className="p-4 rounded-2xl border border-border/80 bg-muted/15 space-y-2.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Booker Information
                </span>
                <div className="space-y-1">
                  {event.contactName && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>{event.contactName}</span>
                    </div>
                  )}
                  {event.contactEmail && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{event.contactEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!is1to1 && !isExternal && (
              <div className="p-4 rounded-2xl border border-border/80 bg-muted/15 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">
                      {event.participantCount ?? 0} Registered
                    </h5>
                    <p className="text-[11px] text-muted-foreground">Audience attendance roster</p>
                  </div>
                </div>
                <Link href={`/admin/meetings/${event.sourceId || event.id}/registrants`}>
                  <Button size="sm" variant="ghost" className="rounded-xl min-h-[44px] sm:min-h-[32px] text-xs font-semibold text-primary hover:underline active:scale-[0.97]">
                    View Roster
                  </Button>
                </Link>
              </div>
            )}

            {isExternal && (
              <div className="p-4 rounded-2xl border border-amber-200/50 bg-amber-50/15 dark:bg-amber-950/10 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Synchronized from external connected calendar to prevent scheduling collisions.</span>
              </div>
            )}
          </div>
        </div>

        {/* Demarcated Footer with Action Buttons */}
        <div className="p-6 border-t border-border/80 bg-muted/15 space-y-2.5">
          {event.joinUrl && event.status !== 'cancelled' && (
            <a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button
                className={`w-full rounded-xl min-h-[44px] font-bold text-xs gap-2 active:scale-[0.97] ${
                  isLive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-500/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <Video className="w-4 h-4" />
                {isLive ? 'Join Room Now' : 'Enter Meeting Room'}
              </Button>
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            {event.joinUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyJoinLink}
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Join Link
              </Button>
            )}

            {!isExternal && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyShareLink}
                className={`rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97] ${
                  !event.joinUrl ? 'col-span-2' : ''
                }`}
              >
                <Share2 className="w-3.5 h-3.5" /> Share Page
              </Button>
            )}
          </div>

          {!isExternal && (
            <Link
              href={
                is1to1
                  ? '/admin/meetings/bookings'
                  : `/admin/meetings/${event.sourceId || event.id}`
              }
              className="block w-full pt-1"
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 active:scale-[0.97]"
              >
                Manage in Studio <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
