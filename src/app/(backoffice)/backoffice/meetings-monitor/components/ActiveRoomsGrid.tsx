/**
 * @fileoverview Active Meeting Rooms Grid Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays active virtual rooms across Zoom, Google Meet, and Daily.co.
 * - Mobile responsive cards with live pulse indicator.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { Video, Users, Clock, Radio, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LiveMeetingSession } from '@/lib/backoffice/backoffice-types';

interface ActiveRoomsGridProps {
  readonly sessions: LiveMeetingSession[];
}

export default function ActiveRoomsGrid({ sessions }: ActiveRoomsGridProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-12 rounded-2xl border border-border bg-card text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto">
          <Video className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">No Live Sessions In Progress</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Scheduled meetings will appear here automatically when participants join the bridge.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map((session) => (
        <Card key={session.meetingId} className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-foreground line-clamp-1">{session.organizationName}</span>
            </div>
            <Badge variant="outline" className="capitalize text-[10px] rounded-lg border-border font-semibold">
              {session.provider.replace('_', ' ')}
            </Badge>
          </div>

          <div>
            <h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">{session.title}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Room ID: {session.meetingId}</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Users className="h-3.5 w-3.5 text-emerald-500" />
              <span>{session.attendeeCount} live participants</span>
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <Clock className="h-3 w-3" />
              <span>{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
