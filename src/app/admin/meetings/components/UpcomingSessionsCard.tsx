'use client';

/**
 * @fileoverview Upcoming Sessions & Webinars Card (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Highlights upcoming high-capacity sessions, orientations, and webinars.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Users, Share2, ArrowRight, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { UnifiedMeetingItem } from '@/lib/meetings/types/unified-meeting';
import { format } from 'date-fns';

export interface UpcomingSessionsCardProps {
  session?: UnifiedMeetingItem | null;
  isLoading?: boolean;
}

export function UpcomingSessionsCard({ session, isLoading = false }: UpcomingSessionsCardProps) {
  const { toast } = useToast();

  const handleShare = () => {
    if (!session) return;
    const shareUrl = `${window.location.origin}/meetings/${session.typeSlug || 'session'}/${session.meetingSlug || session.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Registration Link Copied! 🔗',
      description: 'Public meeting registration link copied to clipboard.',
    });
  };

  const formattedDateTime = React.useMemo(() => {
    if (!session?.startAt) return '';
    try {
      return format(new Date(session.startAt), 'EEEE, MMM d • p');
    } catch {
      return session.startAt;
    }
  }, [session?.startAt]);

  return (
    <Card className="rounded-3xl border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-purple-600" />
            Upcoming Sessions & Webinars
          </CardTitle>
          <CardInfoTooltip text="Broadcast sessions, workshops, and large group meetings." />
        </div>
        <Link href="/admin/meetings/sessions">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold text-primary hover:underline h-7 px-2">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 space-y-3">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
          </div>
        ) : session ? (
          <div className="p-5 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white font-bold text-[10px] uppercase tracking-wider">
                    {session.typeBadge || 'Live Session'}
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground">{formattedDateTime}</span>
                </div>
                <h4 className="text-base font-bold text-foreground">
                  {session.title}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 border px-3 py-1.5 rounded-xl shrink-0">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <strong className="text-foreground font-bold">{session.participantCount}</strong> Registered
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {session.notes || 'Interactive group session with real-time participation, presentation staging, and live audience Q&A.'}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-200/40 dark:border-purple-900/30">
              <Link href="/admin/meetings/sessions">
                <Button size="sm" className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-bold gap-1.5 px-4 active:scale-[0.97]">
                  <Video className="w-3.5 h-3.5" /> Manage Sessions
                </Button>
              </Link>
              {session.joinUrl && (
                <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="secondary" className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-bold gap-1.5 px-4 active:scale-[0.97]">
                    Join Room
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 px-3 border-purple-200/60 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 active:scale-[0.97]"
              >
                <Share2 className="w-3.5 h-3.5" /> Share Registration
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3.5 rounded-2xl border border-dashed border-border/80 bg-muted/10">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <Video className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">No upcoming group sessions scheduled</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Schedule a parent orientation, workshop, or webinar broadcast to engage your audience.
              </p>
            </div>
            <Link href="/admin/meetings/new" className="inline-block pt-1">
              <Button size="sm" className="rounded-xl min-h-[44px] text-xs font-bold gap-1.5 px-5 active:scale-[0.97] bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Create Session
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
