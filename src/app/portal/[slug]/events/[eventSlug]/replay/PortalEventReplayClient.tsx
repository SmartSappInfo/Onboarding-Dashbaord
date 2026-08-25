'use client';

/**
 * {{Org_name}} Experience Platform — Event Replay & AI Takeaways Player
 *
 * Dedicated replay player for recorded masterclasses featuring AI executive
 * summaries, bulleted key takeaways, action drills, and slide deck downloads.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { recordEventAttendanceAction } from '@/app/actions/event-actions';
import type { LiveEvent } from '@/lib/types/events';
import type { Portal } from '@/lib/types/portal';
import {
  PlayCircle,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Clock,
  Calendar,
  Share2,
  Award,
} from 'lucide-react';

interface PortalEventReplayClientProps {
  slug: string;
  eventSlug: string;
}

export function PortalEventReplayClient({ slug, eventSlug }: PortalEventReplayClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [hasClaimedPoints, setHasClaimedPoints] = React.useState(false);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Event
  const eventQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && eventSlug
        ? query(
            collection(firestore, 'live_events'),
            where('portalId', '==', portal.id),
            where('slug', '==', eventSlug),
            limit(1)
          )
        : null,
    [firestore, portal?.id, eventSlug]
  );
  const { data: events, isLoading: isLoadingEvent } = useCollection<LiveEvent>(eventQuery);
  const event = events?.[0] ?? null;

  const handleClaimPoints = async () => {
    if (!user || !event || !portal) return;
    try {
      await recordEventAttendanceAction(
        {
          portalId: portal.id,
          eventId: event.id,
          userId: user.uid,
          attendedDurationSeconds: 3600,
        },
        slug,
        eventSlug
      );
      setHasClaimedPoints(true);
      toast({ title: 'Points Claimed! 🏆', description: '+20 Attendance Points added to your profile.' });
    } catch (err: any) {
      toast({ title: 'Claim Failed', description: err?.message });
    }
  };

  if (isLoadingPortal || isLoadingEvent) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[400px] rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }

  if (!portal || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 rounded-3xl border-2 border-border space-y-3">
          <h2 className="text-xl font-bold">Replay Not Found</h2>
          <p className="text-xs text-muted-foreground">This session recording could not be located.</p>
          <Link href={`/portal/${slug}/events`}>
            <Button variant="outline" className="rounded-xl text-xs font-bold">
              Return to Events
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}/events/${eventSlug}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight hidden sm:inline">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/portal/${slug}/events`}>
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">
              All Sessions
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Replay Viewer Body ────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Video Canvas */}
        <div className="space-y-4">
          <div className="aspect-video w-full rounded-3xl overflow-hidden bg-black shadow-2xl border-2 border-border relative">
            {event.recordingUrl ? (
              event.recordingUrl.includes('youtube') || event.recordingUrl.includes('youtu.be') ? (
                <iframe
                  src={event.recordingUrl.replace('watch?v=', 'embed/')}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : event.recordingUrl.includes('vimeo') ? (
                <iframe
                  src={event.recordingUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={event.recordingUrl} controls className="w-full h-full object-contain" />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white space-y-2">
                <PlayCircle className="w-12 h-12 text-primary" />
                <p className="text-xs font-semibold">Recording is processing...</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-primary/10 text-primary">
                  {event.type.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Recorded on {new Date(event.scheduledStartTime).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground">{event.title}</h1>
              <p className="text-xs text-muted-foreground">with {event.instructorName}</p>
            </div>

            {user && !hasClaimedPoints && (
              <Button
                onClick={handleClaimPoints}
                className="rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm self-start sm:self-auto"
              >
                <Award className="w-4 h-4" /> Claim Attendance Points (+20 pts)
              </Button>
            )}
          </div>
        </div>

        {/* AI Summary & Takeaways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Executive Summary & Key Takeaways */}
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" /> AI Executive Summary
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {event.aiSummary || 'Complete video replay of the live masterclass session. Review the practical demonstrations and guidance presented.'}
                </p>
              </div>

              {event.keyTakeaways && event.keyTakeaways.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h4 className="font-extrabold text-sm text-foreground">Key Takeaways & Core Lessons</h4>
                  <ul className="space-y-2">
                    {event.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Resources & Instructor */}
          <div className="space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-xs">
              <h4 className="font-extrabold text-sm text-foreground">Session Resources</h4>

              {event.slideDeckUrl ? (
                <a href={event.slideDeckUrl} target="_blank" rel="noreferrer" className="block">
                  <Button variant="outline" className="w-full rounded-2xl text-xs font-bold gap-2">
                    <Download className="w-4 h-4 text-primary" /> Download Slide Deck
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Slides included within the video playback canvas.</p>
              )}

              <div className="pt-4 border-t border-border flex items-center gap-3">
                <Avatar className="w-10 h-10 border border-border">
                  {event.instructorAvatarUrl && <AvatarImage src={event.instructorAvatarUrl} alt={event.instructorName} />}
                  <AvatarFallback className="bg-primary text-white font-bold text-xs">
                    {event.instructorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-foreground">{event.instructorName}</p>
                  <p className="text-[10px] text-muted-foreground">Session Instructor</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by SmartSapp Experience Platform.</p>
      </footer>
    </div>
  );
}
