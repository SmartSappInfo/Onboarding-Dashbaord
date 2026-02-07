'use client';

import Image from 'next/image';
import type { School, Meeting } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import JoinMeetingButton from '@/components/join-meeting-button';
import LightRays from '@/components/LightRays';

interface MeetingHeroProps {
  school: School;
  meeting: Meeting;
}

export default function MeetingHero({ school, meeting }: MeetingHeroProps) {

  return (
    <section className="relative w-full bg-background text-foreground pt-28 pb-16 md:pt-40 md:pb-24 min-h-screen flex items-center overflow-hidden">
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
      <div className="relative z-10 container">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 lg:gap-20">
        
          {/* Left Column */}
          <div className="flex flex-col justify-center items-center text-center md:items-start md:text-left">
            
            {school.logoUrl && (
              <div className="mb-12 md:mb-20 flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <Image
                    src={school.logoUrl}
                    alt={`${school.name} logo`}
                    fill
                    className="rounded-full bg-white p-1 shadow-md object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{school.name}</h2>
                  {school.slogan && <p className="text-foreground/80">{school.slogan}</p>}
                </div>
              </div>
            )}

            <h1 className="font-headline text-4xl font-black tracking-tighter sm:text-5xl md:text-6xl">
              {school.name} is digitalizing to serve you better
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-foreground/80">
              Join us for a short onboarding session where we’ll show you how SmartSapp improves communication, payments, and school engagement for parents.
            </p>

            <div className="my-10 w-full">
              <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
            </div>
            
            <div className="w-full sm:w-auto">
              <JoinMeetingButton meetingTime={meeting.meetingTime || ''} meetingLink={meeting.meetingLink || ''} />
            </div>

          </div>

          {/* Right Column */}
          <div className="relative flex items-center justify-center min-h-[300px] sm:min-h-[400px] w-full order-first md:order-last">
              <div className="relative flex items-center justify-center">
                  {school.heroImageUrl ? (
                      <Image
                          src={school.heroImageUrl}
                          alt={`Hero image for ${school.name}`}
                          width={640}
                          height={640}
                          className="relative object-contain"
                          priority
                      />
                  ) : (
                      <div className="relative w-full aspect-square max-w-[640px] rounded-lg bg-white/10 flex items-center justify-center border-4 border-white/10">
                           <span className="text-white/50">No Image</span>
                      </div>
                  )}
              </div>
          </div>
        </div>
      </div>
    </section>
  );
}
