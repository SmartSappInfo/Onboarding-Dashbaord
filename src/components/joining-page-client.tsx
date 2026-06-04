'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Meeting, Entity } from '@/lib/types';
import Image from 'next/image';
import CountdownTimer from '@/components/countdown-timer';
import LightRays from '@/components/LightRays';
import AnimatedHeroShapes from '@/components/animated-hero-shapes';
import { motion } from 'framer-motion';
import { format, isAfter } from 'date-fns';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Rocket,
  Loader2,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logMeetingAttendance } from '@/app/actions/meeting-attendance-actions';

interface JoiningPageClientProps {
  typeSlug: string;
  entitySlug: string;
  token: string | null;
}

type PageState = 'loading' | 'invalid' | 'waiting' | 'launching' | 'redirected' | 'ended';

interface RegistrantInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  token: string;
  registeredAt: string;
  attendedAt?: string;
  registrationData: Record<string, any>;
}

/**
 * JoiningPageClient — The Meeting Waiting Room
 *
 * Flow:
 * 1. Validates the token against the registrants subcollection.
 * 2. If invalid/missing → redirect to registration page.
 * 3. If valid → show "Thank you" + countdown.
 * 4. When meeting time arrives → show "Join Meeting" button.
 * 5. On click → log attendance via server action, then redirect to meeting link.
 *
 * IMPORTANT: Simply landing here does NOT count as attendance.
 * Attendance is only logged when the user clicks "Join Meeting".
 */
export default function JoiningPageClient({ typeSlug, entitySlug, token }: JoiningPageClientProps) {
  const router = useRouter();
  const firestore = useFirestore();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [registrant, setRegistrant] = useState<RegistrantInfo | null>(null);
  const [launchCountdown, setLaunchCountdown] = useState(5);
  const [isJoinReady, setIsJoinReady] = useState(false);

  // ── Step 1: Resolve meeting + validate token ──
  useEffect(() => {
    if (!firestore || !token) {
      // No token → redirect to registration
      router.replace(`/meetings/${typeSlug}/${entitySlug}`);
      return;
    }

    const resolve = async () => {
      try {
        const meetingsCol = collection(firestore, 'meetings');

        // Try meetingSlug first, then entitySlug
        let meetingDoc: Meeting | null = null;

        const slugQuery = query(meetingsCol, where('meetingSlug', '==', entitySlug.toLowerCase()));
        const slugSnap = await getDocs(slugQuery);

        let allMeetings: Meeting[] = [];
        if (!slugSnap.empty) {
          allMeetings = slugSnap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
        } else {
          const legacyQuery = query(meetingsCol, where('entitySlug', '==', entitySlug.toLowerCase()));
          const legacySnap = await getDocs(legacyQuery);
          if (!legacySnap.empty) {
            allMeetings = legacySnap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
          }
        }

        // Filter by type
        const filtered = allMeetings.filter(m => {
          const mTypeSlug = m.type?.slug || '';
          return mTypeSlug === typeSlug || (typeSlug === 'parent-engagement' && m.type?.id === 'parent');
        });

        if (filtered.length === 0) {
          setPageState('invalid');
          return;
        }

        // Pick the best meeting (upcoming first)
        const now = new Date();
        const sorted = filtered.sort((a, b) => {
          const dateA = new Date(a.meetingTime).getTime();
          const dateB = new Date(b.meetingTime).getTime();
          const isAUp = dateA >= now.getTime();
          const isBUp = dateB >= now.getTime();
          if (isAUp && !isBUp) return -1;
          if (!isAUp && isBUp) return 1;
          return Math.abs(dateA - now.getTime()) - Math.abs(dateB - now.getTime());
        });

        meetingDoc = sorted[0];
        setMeeting(meetingDoc);

        // Resolve entity if linked
        if (meetingDoc.entityId) {
          const entityRef = doc(firestore, 'entities', meetingDoc.entityId);
          const entitySnap = await getDoc(entityRef);
          if (entitySnap.exists()) {
            const d = entitySnap.data();
            setEntity({
              id: entitySnap.id,
              name: d.name,
              slug: d.slug || entitySlug,
              logoUrl: d.institutionData?.logoUrl || d.logoUrl,
              slogan: d.institutionData?.slogan || d.slogan,
            } as any);
          }
        }

        // Validate token against registrants
        const registrantsRef = collection(firestore, `meetings/${meetingDoc.id}/registrants`);
        const tokenQuery = query(registrantsRef, where('token', '==', token), limit(1));
        const tokenSnap = await getDocs(tokenQuery);

        if (tokenSnap.empty) {
          // Invalid token → redirect to registration
          router.replace(`/meetings/${typeSlug}/${entitySlug}`);
          return;
        }

        const regDoc = tokenSnap.docs[0];
        const regData = regDoc.data();
        setRegistrant({
          id: regDoc.id,
          name: regData.name || '',
          email: regData.email,
          phone: regData.phone,
          status: regData.status,
          token: regData.token,
          registeredAt: regData.registeredAt,
          attendedAt: regData.attendedAt,
          registrationData: regData.registrationData || {},
        });

        // Check if already attended AND meeting is completed
        const duration = meetingDoc.durationMinutes ?? 60;
        const endTime = new Date(new Date(meetingDoc.meetingTime).getTime() + duration * 60 * 1000);

        if (regData.status === 'attended' && (meetingDoc.recordingUrl || now >= endTime)) {
          setPageState('ended');
        } else {
          setPageState('waiting');
        }
      } catch (error) {
        console.error('[JoiningPageClient] Resolution failed:', error);
        setPageState('invalid');
      }
    };

    resolve();
  }, [firestore, token, typeSlug, entitySlug, router]);

  // ── Step 2: Monitor meeting time for auto-readiness ──
  useEffect(() => {
    if (!meeting || pageState !== 'waiting') return;

    const checkTime = () => {
      const meetingTime = new Date(meeting.meetingTime);
      const now = new Date();
      // Allow entry 5 minutes early
      const entryTime = new Date(meetingTime.getTime() - 5 * 60 * 1000);
      const duration = meeting.durationMinutes ?? 60;
      const endTime = new Date(meetingTime.getTime() + duration * 60 * 1000);

      if (meeting.recordingUrl || isAfter(now, endTime)) {
        setPageState('ended');
      } else if (isAfter(now, entryTime)) {
        setIsJoinReady(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [meeting, pageState]);

  // ── Step 3: Handle "Join Meeting" click — THIS logs attendance ──
  const handleJoinMeeting = useCallback(async () => {
    if (!meeting || !registrant || pageState === 'redirected') return;
    setPageState('launching');

    // Extract children from registration data
    const regData = registrant.registrationData || {};
    const childrenRaw =
      regData.children ||
      regData.childrenNames ||
      regData['Children Names'] ||
      regData['Child Names'] ||
      [];
    const childrenArray = Array.isArray(childrenRaw)
      ? childrenRaw
      : typeof childrenRaw === 'string'
        ? childrenRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    // Log attendance via server action
    await logMeetingAttendance(meeting.id, registrant.id, {
      registrantName: registrant.name,
      registrantToken: registrant.token,
      entityId: meeting.entityId,
      childrenNames: childrenArray,
    });

    // Countdown before redirect
    let count = 5;
    setLaunchCountdown(count);
    const interval = setInterval(() => {
      count--;
      setLaunchCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        if (meeting.meetingLink) {
          window.location.href = meeting.meetingLink;
        } else {
          setPageState('redirected');
        }
      }
    }, 1000);
  }, [meeting, registrant, pageState]);

  // ── Branding resolution ──
  const resolvedLogo = meeting?.logoUrl || (entity as any)?.logoUrl || null;
  const resolvedName =
    meeting?.brandingName || (entity ? ((entity as any).displayName || entity.name || '') : '');
  const firstName = registrant?.name?.split(' ')[0] || 'there';

  // ── Loading state ──
  if (pageState === 'loading') {
    return (
      <section className="relative w-full bg-background min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
            Verifying your registration...
          </p>
        </div>
      </section>
    );
  }

  // ── Invalid state ──
  if (pageState === 'invalid' || !meeting) {
    return (
      <section className="relative w-full bg-background min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <ShieldCheck className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-black tracking-tight">Session Not Found</h1>
          <p className="text-muted-foreground font-medium">
            This link may be expired or invalid. Please register to get a valid access link.
          </p>
          <Button
            onClick={() => router.push(`/meetings/${typeSlug}/${entitySlug}`)}
            className="rounded-xl font-bold h-12 px-8"
          >
            Go to Registration
          </Button>
        </div>
      </section>
    );
  }

  // ── Main Waiting Room UI ──
  return (
    <section className="relative w-full bg-background text-foreground min-h-screen flex items-center overflow-hidden pt-16 sm:pt-20 md:pt-24 pb-12 sm:pb-16">
      <LightRays
        raysOrigin="top-center"
        raysColor="#3B5FFF"
        raysSpeed={1}
        lightSpread={0.5}
        rayLength={3}
        followMouse={true}
        mouseInfluence={0.4}
        noiseAmount={0}
        distortion={0}
        pulsating
        fadeDistance={1}
        saturation={1}
        className="!absolute inset-0"
      />
      <AnimatedHeroShapes />

      <div className="relative z-10 container max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-8"
        >
          {/* Branding */}
          {resolvedLogo && (
            <div className="flex justify-center">
              <div className="relative w-14 h-14 sm:w-20 sm:h-20">
                <Image
                  src={resolvedLogo}
                  alt={resolvedName || 'Meeting'}
                  fill
                  sizes="80px"
                  className="rounded-full bg-white p-1 shadow-lg object-contain"
                />
              </div>
            </div>
          )}

          {/* Launching State */}
          {pageState === 'launching' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 sm:p-10 md:p-12 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-8 shadow-2xl max-w-md mx-auto"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="mx-auto bg-primary/20 w-24 h-24 rounded-full flex items-center justify-center"
              >
                <Rocket className="h-12 w-12 text-primary" />
              </motion.div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-foreground tracking-tight">
                  Launching Meeting Room...
                </p>
                <p className="text-5xl sm:text-7xl font-black text-primary tabular-nums">
                  {launchCountdown}
                </p>
              </div>
            </motion.div>
          )}

          {/* Redirected State */}
          {pageState === 'redirected' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 sm:p-10 md:p-12 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl max-w-md mx-auto"
            >
              <div className="mx-auto bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-foreground tracking-tight">You're In!</p>
                <p className="text-sm text-foreground/60 font-medium">
                  The meeting room has been opened in a new tab.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open(meeting.meetingLink, '_blank')}
                className="rounded-xl font-bold border-white/20 hover:bg-white/10 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Reopen Meeting Room
              </Button>
            </motion.div>
          )}

          {/* Ended State */}
          {pageState === 'ended' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 sm:p-10 md:p-12 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl max-w-md mx-auto"
            >
              <div className="mx-auto bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-foreground tracking-tight">Session Complete</p>
                <p className="text-sm text-foreground/60 font-medium">
                  Thank you for attending, {firstName}!
                </p>
              </div>
              {meeting.recordingUrl && (
                <Button
                  onClick={() => router.push(`/meetings/${typeSlug}/${entitySlug}#recording`)}
                  className="rounded-xl font-bold h-12 px-8"
                >
                  Watch Recording
                </Button>
              )}
            </motion.div>
          )}

          {/* Waiting State — Main View */}
          {pageState === 'waiting' && registrant && (
            <>
              {/* Thank you header */}
              <div className="space-y-4">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                >
                  {meeting.type?.name || 'Meeting Session'}
                </Badge>

                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                  Thank you, {firstName}! 🎉
                </h1>

                <p className="text-base sm:text-lg text-foreground/70 font-medium max-w-lg mx-auto leading-relaxed">
                  Your registration for{' '}
                  <span className="font-bold text-foreground">
                    {meeting.heroTitle || resolvedName || 'this session'}
                  </span>{' '}
                  has been confirmed. The meeting room will open automatically when it's time.
                </p>
              </div>

              {/* Meeting Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-5 sm:p-8 md:p-10 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-2xl max-w-lg mx-auto space-y-8"
              >
                {/* Date & Time */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm md:text-base font-semibold text-primary">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span>{format(new Date(meeting.meetingTime), 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span>{format(new Date(meeting.meetingTime), 'h:mm a')}</span>
                  </div>
                </div>

                {/* Countdown */}
                <div className="pt-2">
                  <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
                </div>

                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Registration Confirmed
                </div>

                {/* Join button — appears when meeting time is near */}
                {isJoinReady && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <Button
                      onClick={handleJoinMeeting}
                      size="lg"
                      className="w-full h-14 sm:h-16 rounded-2xl font-black text-base sm:text-lg uppercase tracking-widest gap-3 shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                    >
                      <Rocket className="h-5 w-5 sm:h-6 sm:w-6" />
                      Join Meeting Now
                    </Button>
                  </motion.div>
                )}
              </motion.div>

              {/* Registration details */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-foreground/40 text-xs font-medium space-y-1"
              >
                <p>
                  Registered as:{' '}
                  <span className="text-foreground/60">{registrant.name}</span>
                </p>
                {registrant.email && (
                  <p>
                    Email: <span className="text-foreground/60">{registrant.email}</span>
                  </p>
                )}
                <p className="mt-4">
                  <button
                    onClick={() => router.push(`/meetings/${typeSlug}/${entitySlug}`)}
                    className="text-foreground/30 text-[10px] font-bold hover:text-foreground/60 transition-colors"
                  >
                    Not {firstName}? Go to Registration →
                  </button>
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
