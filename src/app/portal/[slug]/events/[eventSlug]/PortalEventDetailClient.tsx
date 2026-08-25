'use client';

/**
 * {{Org_name}} Experience Platform — Event Detail & Registration Landing
 *
 * Dedicated landing page for scheduled webinars, workshops, and coaching clinics
 * featuring real-time countdown clocks, host biographies, and 1-click registration.
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
import { registerForEventAction, cancelEventRegistrationAction } from '@/app/actions/event-actions';
import type { LiveEvent, EventRegistration } from '@/lib/types/events';
import type { Portal } from '@/lib/types/portal';
import {
  Calendar,
  Clock,
  Video,
  Users,
  PlayCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  CalendarPlus,
  Loader2,
  Share2,
} from 'lucide-react';

interface PortalEventDetailClientProps {
  slug: string;
  eventSlug: string;
}

export function PortalEventDetailClient({ slug, eventSlug }: PortalEventDetailClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  // 3. Query User Registration
  const registrationQuery = useMemoFirebase(
    () =>
      firestore && event?.id && user?.uid
        ? query(
            collection(firestore, 'event_registrations'),
            where('eventId', '==', event.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, event?.id, user?.uid]
  );
  const { data: registrations } = useCollection<EventRegistration>(registrationQuery);
  const registration = registrations?.[0] ?? null;
  const isRegistered = registration?.status === 'registered';

  // Countdown Clock State
  const [timeLeft, setTimeLeft] = React.useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  React.useEffect(() => {
    if (!event) return;

    const target = new Date(event.scheduledStartTime).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [event]);

  const handleRegister = async () => {
    if (!user) {
      toast({ title: 'Sign In Required', description: 'Please sign in to register for live events.' });
      return;
    }
    if (!event || !portal) return;

    setIsSubmitting(true);
    try {
      const res = await registerForEventAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          eventId: event.id,
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'Member',
          userEmail: user.email || '',
        },
        slug,
        eventSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Registration Confirmed! 🎉', description: 'Your seat is reserved. +15 Points Earned.' });
    } catch (err: any) {
      toast({ title: 'Registration Failed', description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!user || !event) return;
    if (!confirm('Are you sure you want to cancel your seat for this event?')) return;

    setIsSubmitting(true);
    try {
      const res = await cancelEventRegistrationAction(event.id, user.uid, slug, eventSlug);
      if (!res.success) throw new Error(res.error);
      toast({ title: 'Registration Cancelled', description: 'Your seat has been released.' });
    } catch (err: any) {
      toast({ title: 'Cancellation Failed', description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!event) return;
    const startIso = new Date(event.scheduledStartTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endIso = new Date(event.scheduledEndTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SmartSapp Experience Platform//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || 'Masterclass session'}\\n\\nJoin Room: ${event.meetingUrl}`,
      `DTSTART:${startIso}`,
      `DTEND:${endIso}`,
      `LOCATION:${event.meetingUrl}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.slug}-invitation.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Calendar Downloaded! 📅', description: 'Add the .ics file to Apple Calendar or Outlook.' });
  };

  if (isLoadingPortal || isLoadingEvent) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }

  if (!portal || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 rounded-3xl border-2 border-border space-y-3">
          <h2 className="text-xl font-bold">Event Not Found</h2>
          <p className="text-xs text-muted-foreground">The scheduled live session could not be located.</p>
          <Link href={`/portal/${slug}/events`}>
            <Button variant="outline" className="rounded-xl text-xs font-bold">
              Return to Events Directory
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;
  const startTime = new Date(event.scheduledStartTime);
  const endTime = new Date(event.scheduledEndTime);
  const isPast = startTime.getTime() < Date.now();
  const hasReplay = Boolean(event.recordingUrl);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}/events`}>
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

      {/* ── Main Landing Layout ───────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Hero Banner */}
        <div
          className="p-8 md:p-12 rounded-3xl text-white relative overflow-hidden flex flex-col justify-between gap-6 shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
          }}
        >
          <div className="space-y-3 max-w-2xl relative z-10">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs font-bold px-3 py-1 uppercase tracking-wider">
                {event.type.replace('_', ' ')}
              </Badge>
              {hasReplay && (
                <Badge className="bg-emerald-500 text-white font-bold text-xs px-3 py-1 gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> Replay Ready
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{event.title}</h1>
            {event.description && (
              <p className="text-xs sm:text-sm text-white/85 leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Countdown Clock (If Upcoming) */}
          {!isPast && (
            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md pt-2 relative z-10">
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-center">
                <span className="font-black text-xl sm:text-3xl block">{timeLeft.days}</span>
                <span className="text-[10px] uppercase font-bold text-white/80">Days</span>
              </div>
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-center">
                <span className="font-black text-xl sm:text-3xl block">{timeLeft.hours}</span>
                <span className="text-[10px] uppercase font-bold text-white/80">Hours</span>
              </div>
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-center">
                <span className="font-black text-xl sm:text-3xl block">{timeLeft.minutes}</span>
                <span className="text-[10px] uppercase font-bold text-white/80">Mins</span>
              </div>
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-center">
                <span className="font-black text-xl sm:text-3xl block">{timeLeft.seconds}</span>
                <span className="text-[10px] uppercase font-bold text-white/80">Secs</span>
              </div>
            </div>
          )}
        </div>

        {/* Action & Schedule Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Agenda & Speaker Bio */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card">
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg text-foreground">Session Overview</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {event.description || 'Interactive live session covering practical implementations and drills.'}
                </p>
              </div>

              {/* Speaker Card */}
              <div className="p-5 rounded-2xl border border-border bg-muted/20 flex items-center gap-4">
                <Avatar className="w-14 h-14 border-2 border-white shadow-md">
                  {event.instructorAvatarUrl && <AvatarImage src={event.instructorAvatarUrl} alt={event.instructorName} />}
                  <AvatarFallback className="bg-primary text-white font-black text-lg">
                    {event.instructorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Session Host</span>
                  <h4 className="font-extrabold text-base text-foreground">{event.instructorName}</h4>
                  {event.instructorTitle && (
                    <p className="text-xs text-muted-foreground">{event.instructorTitle}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Ticket Card & Registration Controls */}
          <div className="space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 space-y-5 bg-card shadow-xs">
              <div className="space-y-3 border-b border-border pb-4">
                <h4 className="font-extrabold text-base text-foreground">Live Session Access</h4>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      {startTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>
                      {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({event.durationMinutes} Mins)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    <span>Hosted on {event.meetingProvider.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{event.registeredCount} Members Registered</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {hasReplay ? (
                  <Link href={`/portal/${slug}/events/${event.slug}/replay`} className="block">
                    <Button className="w-full h-11 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm">
                      <PlayCircle className="w-4 h-4" /> Watch Replay & AI Summary
                    </Button>
                  </Link>
                ) : isRegistered ? (
                  <div className="space-y-2">
                    <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="block">
                      <Button className="w-full h-11 rounded-2xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 gap-2 shadow-sm">
                        <Video className="w-4 h-4" /> Enter Live Room <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>

                    <Button
                      variant="outline"
                      onClick={handleDownloadIcs}
                      className="w-full h-10 rounded-2xl font-bold text-xs gap-2"
                    >
                      <CalendarPlus className="w-4 h-4 text-primary" /> Add to Calendar (.ics)
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleCancelRegistration}
                      disabled={isSubmitting}
                      className="w-full h-8 text-[11px] text-muted-foreground hover:text-rose-500"
                    >
                      Cancel Registration
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleRegister}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register for Session (Free)'}
                  </Button>
                )}
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
