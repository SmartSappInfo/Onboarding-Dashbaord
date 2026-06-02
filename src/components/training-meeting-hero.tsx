
'use client';

import Image from 'next/image';
import type { School, Meeting, Entity } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import JoinMeetingForm from '@/components/join-meeting-form';
import LightRays from '@/components/LightRays';
import { format, isAfter } from 'date-fns';
import { Calendar, Clock, PlayCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ScrollDownIndicator from './scroll-down-indicator';
import { cn } from '@/lib/utils';
import AnimatedHeroShapes from './animated-hero-shapes';
import { motion } from 'framer-motion';
import { getHeroTitle, getHeroDescription } from '@/lib/meeting-hero-defaults';
import MeetingJoinSection from '@/components/meeting-join-section';

interface TrainingMeetingHeroProps {
  entity: Entity | School | null;
  meeting: Meeting;
  tokenResult?: any;
  nextSectionId?: string;
}

const DEFAULT_HERO = "https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/image%2FRelief%20woman%20whtie.png?alt=media&token=b7cef605-a227-4d36-bc9d-9248c27331e0";

export default function TrainingMeetingHero({ entity, meeting, tokenResult, nextSectionId }: TrainingMeetingHeroProps) {
  const [meetingState, setMeetingState] = useState<'UPCOMING' | 'ENDED_NO_RECORDING' | 'ENDED_WITH_RECORDING'>('UPCOMING');

  // V3: Branding resolution
  const resolvedLogo = meeting.logoUrl || (entity as any)?.logoUrl || null;
  const resolvedName = meeting.brandingName || (entity ? ((entity as any).displayName || (entity as any).name || '') : '');
  const resolvedSlogan = meeting.brandingSlogan || (entity ? ((entity as any).slogan || '') : '');
  
  const showBranding = meeting.brandingEnabled !== false && (resolvedLogo || resolvedName);
  const showFormLayout = meeting.heroLayout === 'form' && meeting.registrationEnabled;

  const registrant = tokenResult?.registrant || null;
  const isConfirmed = registrant && (registrant.status === 'approved' || registrant.status === 'attended' || registrant.status === 'registered');
  const showHeroCountdown = meetingState === 'UPCOMING' && !isConfirmed;

  useEffect(() => {
    const checkMeetingState = () => {
      if (meeting.recordingUrl) {
        setMeetingState('ENDED_WITH_RECORDING');
        return;
      }
      
      const meetingEndTime = new Date(new Date(meeting.meetingTime).getTime() + 2 * 60 * 60 * 1000); // 2 hours after start
      if (isAfter(new Date(), meetingEndTime)) {
        setMeetingState('ENDED_NO_RECORDING');
      } else {
        setMeetingState('UPCOMING');
      }
    };

    checkMeetingState();
    const interval = setInterval(checkMeetingState, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [meeting.meetingTime, meeting.recordingUrl]);

  const hasBanner = meeting.bannerType !== 'none' && (
    (meeting.bannerType === 'image' && meeting.bannerImageUrl) ||
    (meeting.bannerType === 'embed' && meeting.bannerEmbedCode)
  );

  return (
    <section className="relative w-full bg-background text-foreground pb-16 md:pb-24 min-h-screen flex items-center overflow-visible md:overflow-hidden pt-24 md:pt-32">
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

      <div className="relative z-10 container">
        <div className="flex flex-col gap-4">

          {/* Banner Row — spans full width, rounded, bento-card style */}
          {hasBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-lg"
            >
              {meeting.bannerType === 'image' && meeting.bannerImageUrl && (
                <div className="relative w-full aspect-[21/6] md:aspect-[32/8] max-h-[240px]">
                  <Image src={meeting.bannerImageUrl} alt="Meeting Banner" fill className="object-cover" priority />
                </div>
              )}
              {meeting.bannerType === 'embed' && meeting.bannerEmbedCode && (
                <div 
                  className="w-full flex justify-center overflow-hidden bg-black/20 backdrop-blur-sm py-3"
                  dangerouslySetInnerHTML={{ __html: meeting.bannerEmbedCode }}
                />
              )}
            </motion.div>
          )}

          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 lg:gap-20">
        
            {/* Left Column */}
            <div className="flex flex-col justify-center items-center text-center md:items-start md:text-left">
            
              {showBranding && (
                <div className="mb-8 md:mb-12 flex items-center gap-4">
                  {resolvedLogo && (
                    <div className="relative w-16 h-16">
                      <Image
                        src={resolvedLogo}
                        alt={`${resolvedName || 'Meeting'} logo`}
                        fill
                        className="rounded-full bg-white p-1 shadow-md object-contain"
                      />
                    </div>
                  )}
                  {resolvedName && (
                    <div>
                      <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">{resolvedName}</h2>
                      {resolvedSlogan && <p className="text-slate-700/80 dark:text-slate-300/80 font-medium italic">{resolvedSlogan}</p>}
                    </div>
                  )}
                </div>
              )}

              <Badge variant="secondary" className="mb-4 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                {meeting.type?.name || 'Training'}
              </Badge>

              <h1 className="font-headline text-3xl font-black tracking-tighter sm:text-5xl md:text-6xl uppercase leading-none">
                {getHeroTitle(meeting.type?.id || 'training', resolvedName, meeting.heroTitle)}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-foreground/80 font-medium max-w-xl">
                {getHeroDescription(meeting.type?.id || 'training', resolvedName, meeting.heroDescription)}
              </p>

              <div className="my-8 w-full">
                 <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-x-6 gap-y-2 text-xl font-black uppercase mb-4 text-primary">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        <span>{format(new Date(meeting.meetingTime), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <span>{format(new Date(meeting.meetingTime), "h:mm a")}</span>
                    </div>
                </div>
                {showHeroCountdown && <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />}
              </div>
            
              {meetingState === 'UPCOMING' && !showFormLayout && (
                <MeetingJoinSection meeting={meeting} entityId={entity?.id} tokenResult={tokenResult} />
              )}
            
              {meetingState === 'ENDED_NO_RECORDING' && (
                <div className="w-full max-w-md mx-auto md:mx-0 p-6 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-center shadow-xl">
                  <p className="text-lg font-black uppercase text-foreground">Meeting has ended</p>
                  <p className="text-xs font-bold text-muted-foreground uppercase mt-1">Recording will be available soon</p>
                </div>
              )}

              {meetingState === 'ENDED_WITH_RECORDING' && (
                <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl active:scale-95 transition-all">
                  <a href="#recording">
                    <PlayCircle className="mr-2 h-6 w-6" />
                    Watch Meeting Recording
                  </a>
                </Button>
              )}

            </div>

            {/* Right Column */}
            <div className="relative flex items-center justify-center min-h-[280px] md:min-h-[400px] w-full order-last">
                {showFormLayout && meetingState === 'UPCOMING' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full max-w-lg"
                  >
                    <MeetingJoinSection meeting={meeting} entityId={entity?.id} tokenResult={tokenResult} />
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="relative flex items-center justify-center w-full max-w-[640px]"
                  >
                    <div className="relative aspect-square w-full">
                        <Image
                            src={meeting.heroImageUrl || DEFAULT_HERO}
                            alt={`Hero image for ${resolvedName || 'meeting'}`}
                            fill
                            className="object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(59,95,255,0.3)]"
                            priority
                        />
                    </div>
                  </motion.div>
                )}
            </div>
          </div>
        </div>
      </div>
      {nextSectionId && <ScrollDownIndicator href={nextSectionId} />}
    </section>
  );
}
