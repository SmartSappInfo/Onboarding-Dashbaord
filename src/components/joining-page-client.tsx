'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Meeting, Entity, MeetingFacilitator } from '@/lib/types';
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
  Camera,
  Upload,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateMeetingFacilitatorAction, logFacilitatorAttendance } from '@/app/actions/meeting-facilitator-actions';
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
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(5);
  const [isRedirectTriggered, setIsRedirectTriggered] = useState(false);

  // Facilitator state variables
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [facilitator, setFacilitator] = useState<MeetingFacilitator | null>(null);
  const [facName, setFacName] = useState('');
  const [facBio, setFacBio] = useState('');
  const [facImage, setFacImage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');

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

        // Check facilitators first
        const matchedFac = meetingDoc.facilitators?.find(f => f.joinLink === token);
        if (matchedFac) {
          setIsFacilitator(true);
          setFacilitator(matchedFac);
          setFacName(matchedFac.name || '');
          setFacBio(matchedFac.bio || '');
          setFacImage(matchedFac.image || '');
          setPageState('waiting');
          return;
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

        // Check if already attended OR if the meeting is ended
        const duration = meetingDoc.durationMinutes ?? 60;
        const endTime = new Date(new Date(meetingDoc.meetingTime).getTime() + duration * 60 * 1000);

        if (meetingDoc.status === 'ended' || (regData.status === 'attended' && (meetingDoc.recordingUrl || now >= endTime))) {
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

      if (meeting.status === 'ended' || meeting.recordingUrl || isAfter(now, endTime)) {
        setPageState('ended');
      } else if (isFacilitator || isAfter(now, entryTime)) {
        setIsJoinReady(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [meeting, pageState, isFacilitator]);

  // ── Handle Auto-Redirect Countdown (when meeting is ready) ──
  useEffect(() => {
    if (isFacilitator) return;
    if (!isJoinReady || pageState !== 'waiting' || isRedirectTriggered) return;

    let count = 5;
    setAutoRedirectCountdown(count);

    const interval = setInterval(() => {
      count--;
      setAutoRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        handleJoinMeeting();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isJoinReady, pageState, isRedirectTriggered, isFacilitator]);

  // ── Handle Ended State Automatic Redirect to Main Page ──
  useEffect(() => {
    if (pageState !== 'ended') return;

    let count = 5;
    setRedirectCountdown(count);

    const interval = setInterval(() => {
      count--;
      setRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        router.replace(`/meetings/${typeSlug}/${entitySlug}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pageState, typeSlug, entitySlug, router]);

  // ── Facilitator Handlers ──
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !meeting || !facilitator) return;
    const file = event.target.files[0];
    setIsUploadingPhoto(true);
    setUploadError('');
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `facilitator-pictures/${meeting.id}-${facilitator.id}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const res = await updateMeetingFacilitatorAction(meeting.id, facilitator.id, {
        name: facName,
        bio: facBio,
        image: downloadURL,
      });

      if (res.success) {
        setFacImage(downloadURL);
        setFacilitator(prev => prev ? { ...prev, image: downloadURL } : null);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 3000);
      }
    } catch (err: any) {
      console.error('[FacilitatorPhotoUpload] Failed:', err);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateName = async (newName: string) => {
    if (!meeting || !facilitator || !newName.trim()) return;
    setIsSavingProfile(true);
    try {
      const res = await updateMeetingFacilitatorAction(meeting.id, facilitator.id, {
        name: newName,
        bio: facBio,
        image: facImage,
      });
      if (res.success) {
        setFacName(newName);
        setFacilitator(prev => prev ? { ...prev, name: newName } : null);
        setIsEditingName(false);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 3000);
      }
    } catch (err) {
      console.error('[handleUpdateName] Failed:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdateBio = async (newBio: string) => {
    if (!meeting || !facilitator) return;
    setIsSavingProfile(true);
    try {
      const res = await updateMeetingFacilitatorAction(meeting.id, facilitator.id, {
        name: facName,
        bio: newBio,
        image: facImage,
      });
      if (res.success) {
        setFacBio(newBio);
        setFacilitator(prev => prev ? { ...prev, bio: newBio } : null);
        setIsEditingBio(false);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 3000);
      }
    } catch (err) {
      console.error('[handleUpdateBio] Failed:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Step 3: Handle "Join Meeting" click — THIS logs attendance ──
  const handleJoinMeeting = useCallback(async () => {
    if (!meeting || isRedirectTriggered) return;
    setIsRedirectTriggered(true);

    if (isFacilitator && facilitator) {
      try {
        await logFacilitatorAttendance(meeting.id, facilitator.id, {
          name: facName,
          token: token || '',
          entityId: meeting.entityId,
        });
      } catch (err) {
        console.error('[JoiningPageClient] Facilitator attendance logging failed:', err);
      }
    } else if (registrant) {
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

      try {
        // Log attendance via server action
        await logMeetingAttendance(meeting.id, registrant.id, {
          registrantName: registrant.name,
          registrantToken: registrant.token,
          entityId: meeting.entityId,
          childrenNames: childrenArray,
        });
      } catch (err) {
        console.error('[JoiningPageClient] Attendance logging failed:', err);
      }
    }

    if (meeting.meetingLink) {
      window.location.href = meeting.meetingLink;
    } else {
      setPageState('redirected');
    }
  }, [meeting, registrant, isFacilitator, facilitator, facName, token, isRedirectTriggered]);

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
                <p className="text-xs text-muted-foreground mt-2 font-semibold">
                  This webinar has ended. Redirecting you to the main page in <span className="text-primary font-bold text-sm">{redirectCountdown}s</span>...
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
          {pageState === 'waiting' && (isFacilitator || registrant) && (
            <>
              {isFacilitator ? (
                /* Compact Center-Aligned Facilitator Layout */
                <div className="max-w-md mx-auto w-full space-y-6">
                  {/* Top Header */}
                  <div className="space-y-3 text-center">
                    <div className="flex justify-center">
                      <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                        Presenter Workspace
                      </Badge>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-slate-900 dark:text-white">
                      Welcome, {facName}!
                    </h1>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                      Verify or adjust your presenter details before launching the webinar room.
                    </p>
                  </div>

                  {/* Compact Sleek Card */}
                  <div className="p-6 rounded-[2rem] bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shadow-2xl backdrop-blur-md space-y-6">
                    {/* Horizontal Layout for Profile (Left: Avatar, Right: Name/Bio) */}
                    <div className="flex items-center gap-6 text-left w-full">
                      {/* Left: Interactive Avatar Upload */}
                      <div className="relative group cursor-pointer shrink-0">
                        <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary/25 group-hover:ring-primary/50 transition-all bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                          {facImage ? (
                            <img src={facImage} alt={facName} className="w-full h-full object-cover animate-fade-in" />
                          ) : (
                            <span className="text-lg font-bold uppercase text-slate-500 dark:text-primary/40">
                              {facName ? facName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                            </span>
                          )}
                          {isUploadingPhoto && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        {!isUploadingPhoto && (
                          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          id="fac-photo-input"
                          ref={fileInputRef}
                        />
                        <label htmlFor="fac-photo-input" className="absolute inset-0 cursor-pointer rounded-full" />
                      </div>

                      {/* Right: Name and Bio */}
                      <div className="flex-grow space-y-2 min-w-0">
                        {/* Name Field */}
                        <div>
                          {!isEditingName ? (
                            <div className="flex items-center gap-2 group min-h-[2.5rem]">
                              <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {facName || 'No Name'}
                              </span>
                              <button
                                onClick={() => {
                                  setIsEditingName(true);
                                  setTempName(facName);
                                }}
                                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                                aria-label="Edit Name"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 max-w-xs min-h-[2.5rem]">
                              <Input
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="h-9 bg-slate-100 dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-semibold text-sm focus-visible:ring-primary focus-visible:ring-offset-0"
                                placeholder="Presenter Name"
                              />
                              <button
                                onClick={() => handleUpdateName(tempName)}
                                disabled={isSavingProfile}
                                className="text-emerald-500 hover:text-emerald-400 p-1 shrink-0"
                                aria-label="Save Name"
                              >
                                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => setIsEditingName(false)}
                                disabled={isSavingProfile}
                                className="text-rose-500 hover:text-rose-400 p-1 shrink-0"
                                aria-label="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bio Field */}
                        <div>
                          {!isEditingBio ? (
                            <div className="flex items-start gap-2 group min-h-[2rem]">
                              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-[260px]">
                                {facBio || 'No Bio Specified'}
                              </p>
                              <button
                                onClick={() => {
                                  setIsEditingBio(true);
                                  setTempBio(facBio);
                                }}
                                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 shrink-0 mt-0.5"
                                aria-label="Edit Bio"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 max-w-xs w-full">
                              <Textarea
                                value={tempBio}
                                onChange={(e) => setTempBio(e.target.value)}
                                className="h-14 bg-slate-100 dark:bg-slate-955/60 border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-medium text-xs focus-visible:ring-primary focus-visible:ring-offset-0 resize-none p-2"
                                placeholder="Presenter Bio"
                              />
                              <div className="flex gap-4">
                                <button
                                  onClick={() => handleUpdateBio(tempBio)}
                                  disabled={isSavingProfile}
                                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                                >
                                  {isSavingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Save
                                </button>
                                <button
                                  onClick={() => setIsEditingBio(false)}
                                  disabled={isSavingProfile}
                                  className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-400 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {uploadError && (
                      <p className="text-rose-400 text-xs font-semibold mt-2">{uploadError}</p>
                    )}

                    {showSavedNotification && (
                      <p className="text-emerald-500 dark:text-emerald-400 text-xs font-semibold animate-pulse mt-2 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Profile details saved!
                      </p>
                    )}

                    {/* Divider */}
                    <div className="border-t border-slate-200 dark:border-white/10 my-4" />

                    {/* Meeting Info */}
                    <div className="space-y-2 text-center">
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                        {meeting.heroTitle || resolvedName || 'SmartSapp Kickoff Session'}
                      </h4>
                      <div className="flex flex-col gap-0.5 items-center justify-center text-xs font-semibold text-primary">
                        <span>{format(new Date(meeting.meetingTime), 'EEEE, MMMM d, yyyy')}</span>
                        <span>{format(new Date(meeting.meetingTime), 'h:mm a')}</span>
                      </div>
                    </div>

                    {/* Join Action */}
                    <div className="space-y-2 pt-2">
                      <Button
                        onClick={handleJoinMeeting}
                        disabled={isRedirectTriggered || isUploadingPhoto}
                        size="lg"
                        className="w-full h-12 bg-primary hover:bg-primary/95 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2"
                      >
                        {isRedirectTriggered ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Rocket className="h-4 w-4" />
                        )}
                        Join Meeting Now
                      </Button>
                      <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        Always open for facilitators
                      </p>
                    </div>

                  </div>
                </div>
              ) : (
                /* Registrant Layout (Existing logic) */
                <>
                  {/* Thank you header */}
                  <div className="space-y-4">
                    {isJoinReady ? (
                      <>
                        <Badge
                          variant="default"
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse"
                        >
                          Meeting Active
                        </Badge>

                        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                          Your meeting has started.
                        </h1>

                        <p className="text-base sm:text-lg text-foreground/70 font-medium max-w-lg mx-auto leading-relaxed">
                          Redirecting you to the meeting room automatically. If the redirect does not occur, click the button below.
                        </p>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  {/* Meeting Info Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-5 sm:p-8 md:p-10 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-2xl max-w-lg mx-auto space-y-8 animate-fade-in"
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

                    {/* Countdown / Redirection loading state */}
                    {!isJoinReady ? (
                      <>
                        <div className="pt-2">
                          <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
                        </div>

                        {/* Status indicator */}
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Registration Confirmed
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 space-y-4">
                        {/* Visual 5s countdown inside spinner */}
                        <div className="relative flex items-center justify-center">
                          <Loader2 className="h-16 w-16 text-primary animate-spin" />
                          <span className="absolute text-lg font-black text-primary">
                            {autoRedirectCountdown}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 animate-pulse" />
                          Meeting In Session
                        </div>
                      </div>
                    )}

                    {/* Join button — appears when meeting time is near */}
                    {isJoinReady && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="space-y-4"
                      >
                        {!isRedirectTriggered ? (
                          <p className="text-xs text-primary font-bold animate-pulse text-center">
                            Redirecting to the meeting in <span className="text-sm font-black">{autoRedirectCountdown}s</span>...
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting you to the meeting now...
                          </p>
                        )}
                        <Button
                          onClick={handleJoinMeeting}
                          disabled={isRedirectTriggered}
                          size="lg"
                          className="w-full h-14 sm:h-16 rounded-2xl font-black text-base sm:text-lg uppercase tracking-widest gap-3 shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                        >
                          {isRedirectTriggered ? (
                            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                          ) : (
                            <Rocket className="h-5 w-5 sm:h-6 sm:w-6" />
                          )}
                          {isRedirectTriggered ? 'Joining Session...' : 'Join Meeting Now'}
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
                      <span className="text-foreground/60">{registrant?.name}</span>
                    </p>
                    {registrant?.email && (
                      <p>
                        Email: <span className="text-foreground/60">{registrant?.email}</span>
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
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
