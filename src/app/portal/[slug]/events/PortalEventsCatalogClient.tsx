'use client';

/**
 * {{Org_name}} Experience Platform — Runtime Events & Sessions Catalog
 *
 * Member-facing directory of live webinars, workshops, coaching clinics,
 * and recorded masterclass replays with real-time countdowns and 1-click registration.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { registerForEventAction } from '@/app/actions/event-actions';
import type { LiveEvent, EventRegistration } from '@/lib/types/events';
import type { Portal } from '@/lib/types/portal';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  Calendar,
  Clock,
  Video,
  PlayCircle,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { PortalPageShell } from '../components/PortalPageShell';

interface PortalEventsCatalogClientProps {
  slug: string;
}

export function PortalEventsCatalogClient({ slug }: PortalEventsCatalogClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = React.useState('all');
  const [registeringEventId, setRegisteringEventId] = React.useState<string | null>(null);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Live Events
  const eventsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'live_events'),
            where('portalId', '==', portal.id),
            orderBy('scheduledStartTime', 'asc')
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: events, isLoading: isLoadingEvents } = useCollection<LiveEvent>(eventsQuery);

  // 3. Query User Registrations
  const registrationsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'event_registrations'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            where('status', '==', 'registered')
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: registrations } = useCollection<EventRegistration>(registrationsQuery);

  const registeredEventIds = React.useMemo(() => {
    return new Set((registrations || []).map(r => r.eventId));
  }, [registrations]);

  const handleRegister = async (event: LiveEvent) => {
    if (!user) {
      toast({ title: 'Sign In Required', description: 'Please sign in to register for live events.' });
      return;
    }

    setRegisteringEventId(event.id);
    try {
      const res = await registerForEventAction(
        {
          organizationId: portal?.organizationId || 'smartsapp-hq',
          portalId: portal!.id,
          eventId: event.id,
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'Member',
          userEmail: user.email || '',
        },
        slug,
        event.slug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Seat Confirmed! 🎟️', description: `Registered for "${event.title}". +15 Points Earned.` });
    } catch (err: unknown) {
      toast({ title: 'Registration Failed', description: getErrorMessage(err) });
    } finally {
      setRegisteringEventId(null);
    }
  };

  const filteredEvents = React.useMemo(() => {
    if (!events) return [];
    const now = new Date().getTime();

    if (activeFilter === 'upcoming') {
      return events.filter(e => new Date(e.scheduledStartTime).getTime() > now);
    }
    if (activeFilter === 'replays') {
      return events.filter(e => Boolean(e.recordingUrl));
    }
    return events;
  }, [events, activeFilter]);

  if (isLoadingPortal || isLoadingEvents) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 rounded-3xl border-2 border-border space-y-3">
          <h2 className="text-xl font-bold">Portal Not Found</h2>
          <p className="text-xs text-muted-foreground">The requested academy could not be located.</p>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;

  return (
    <PortalPageShell portal={portal} slug={slug}>
      <div className="max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
        <div
          className="p-8 md:p-12 rounded-3xl text-white relative overflow-hidden flex flex-col justify-between gap-6 shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
          }}
        >
          <div className="space-y-3 max-w-2xl relative z-10">
            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs font-bold px-3 py-1 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Interactive Masterclasses & Clinics
            </Badge>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              Live Learning, Webinars & Coaching
            </h1>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              Join interactive live sessions with specialist instructors, ask burning questions in real-time, and catch up with AI-summarized replays.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full sm:w-auto">
            <TabsList className="h-10 p-1 bg-muted/60 rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl text-xs font-bold gap-1.5">
                All Sessions ({events?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-xl text-xs font-bold gap-1.5">
                Upcoming Live
              </TabsTrigger>
              <TabsTrigger value="replays" className="rounded-xl text-xs font-bold gap-1.5">
                <PlayCircle className="w-3.5 h-3.5" /> Replays Available
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
            <Video className="w-12 h-12 mx-auto text-primary/60" />
            <h4 className="font-bold text-base text-foreground">No Live Sessions Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Check back soon as new interactive webinars, workshops, and coaching clinics are scheduled.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => {
              const isRegistered = registeredEventIds.has(event.id);
              const isRegistering = registeringEventId === event.id;
              const hasReplay = Boolean(event.recordingUrl);
              const startTime = new Date(event.scheduledStartTime);
              const _isPast = startTime.getTime() < Date.now();

              return (
                <Card
                  key={event.id}
                  className="rounded-3xl border-2 border-border p-6 space-y-5 hover:shadow-lg hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-bold uppercase capitalize bg-primary/10 text-primary"
                      >
                        {event.type.replace('_', ' ')}
                      </Badge>

                      {hasReplay ? (
                        <Badge className="bg-emerald-500 text-white font-bold text-[9px] gap-1 py-0.5">
                          <PlayCircle className="w-2.5 h-2.5" /> Replay & Summary
                        </Badge>
                      ) : isRegistered ? (
                        <Badge className="bg-primary text-white font-bold text-[9px] gap-1 py-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Registered ✓
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {event.meetingProvider.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Link href={`/portal/${slug}/events/${event.slug}`}>
                        <h3 className="font-extrabold text-base text-foreground hover:text-primary transition-colors line-clamp-2">
                          {event.title}
                        </h3>
                      </Link>
                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">
                          {startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span>•</span>
                        <span>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>{event.durationMinutes} Minutes</span>
                        <span>•</span>
                        <span>{event.registeredCount} Registered</span>
                      </div>
                    </div>

                    {/* Instructor Card */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <Avatar className="w-8 h-8 border border-border">
                        {event.instructorAvatarUrl && <AvatarImage src={event.instructorAvatarUrl} alt={event.instructorName} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {event.instructorName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="font-bold text-xs text-foreground">{event.instructorName}</p>
                        {event.instructorTitle && (
                          <p className="text-[10px] text-muted-foreground">{event.instructorTitle}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                    <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl text-xs font-bold active:scale-[0.97]">
                      <Link href={`/portal/${slug}/events/${event.slug}`}>
                        Details
                      </Link>
                    </Button>

                    {hasReplay ? (
                      <Button asChild size="sm" className="flex-1 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-2xs active:scale-[0.97]">
                        <Link href={`/portal/${slug}/events/${event.slug}/replay`}>
                          <PlayCircle className="w-3.5 h-3.5" /> Watch Replay
                        </Link>
                      </Button>
                    ) : isRegistered ? (
                      <Button asChild size="sm" className="flex-1 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 gap-1 shadow-2xs active:scale-[0.97]">
                        <a href={event.meetingUrl} target="_blank" rel="noreferrer">
                          Join Room <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isRegistering}
                        onClick={() => handleRegister(event)}
                        className="flex-1 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 gap-1 shadow-2xs"
                      >
                        {isRegistering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Register Free'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalPageShell>
  );
}
