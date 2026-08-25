'use client';

/**
 * @fileoverview Real-time Activity Audit Timeline Drawer for Meeting Occurrences.
 * Displays chronological audit events with actor badges, timestamps, and metadata tags.
 * Follows Emil Kowalski animation patterns with fluid transitions.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Activity,
  UserPlus,
  UserMinus,
  UserCheck,
  Shield,
  CheckCircle2,
  Video,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { MeetingActivity, MeetingActivityType } from '@/lib/meetings/types';
import { getMeetingActivitiesAction } from '@/app/actions/meeting-activity-actions';

interface MeetingActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
}

export function MeetingActivityDrawer({
  open,
  onOpenChange,
  meetingId,
}: MeetingActivityDrawerProps) {
  const [activities, setActivities] = React.useState<MeetingActivity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchActivities = React.useCallback(async () => {
    if (!meetingId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingActivitiesAction(meetingId, 50);
      if (res.success && res.activities) {
        setActivities(res.activities);
      }
    } catch (err) {
      console.error('[MeetingActivityDrawer] Error fetching activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  React.useEffect(() => {
    if (open) {
      fetchActivities();
    }
  }, [open, fetchActivities]);

  const getActivityIcon = (type: MeetingActivityType) => {
    switch (type) {
      case 'participant_joined':
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case 'participant_left':
        return <UserMinus className="w-4 h-4 text-amber-500" />;
      case 'participant_added':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'participant_removed':
        return <UserMinus className="w-4 h-4 text-rose-500" />;
      case 'role_updated':
        return <Shield className="w-4 h-4 text-indigo-500" />;
      case 'rsvp_updated':
        return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
      case 'meeting_started':
      case 'meeting_completed':
        return <Clock className="w-4 h-4 text-sky-500" />;
      case 'meeting_created':
      case 'booking_confirmed':
      default:
        return <Activity className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <SheetTitle className="text-lg font-bold">Activity Audit Stream</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchActivities}
              disabled={isLoading}
              className="rounded-lg h-8 w-8 active:scale-[0.97]"
              title="Refresh timeline"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Immutable timeline of registrations, live check-ins, and meeting state changes.
          </SheetDescription>
        </div>

        {/* Stream Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No activity recorded yet</p>
              <p className="text-xs mt-1">Events will appear as attendees interact with the meeting.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-border space-y-6">
              {activities.map(act => {
                const dateObj = new Date(act.createdAt);
                const isDateValid = !isNaN(dateObj.getTime());

                return (
                  <div key={act.id} className="relative group">
                    {/* Timeline Node */}
                    <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center shadow-xs">
                      {getActivityIcon(act.type)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {act.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {isDateValid ? formatDistanceToNow(dateObj, { addSuffix: true }) : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {act.actorType}
                        </Badge>
                        {isDateValid && (
                          <span className="text-[11px] text-muted-foreground">
                            {format(dateObj, 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
