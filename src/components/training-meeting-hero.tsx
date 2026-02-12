
'use client';

import Image from 'next/image';
import type { School, Meeting } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import JoinMeetingForm from '@/components/join-meeting-form';
import LightRays from '@/components/LightRays';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface TrainingMeetingHeroProps {
  school: School;
  meeting: Meeting;
}

export default function TrainingMeetingHero({ school, meeting }: TrainingMeetingHeroProps) {

  return (
    <section className="relative w-full bg-background text-foreground pt-32 pb-16 md:pt-40 md:pb-24 min-h-screen flex items-center overflow-hidden">
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
              <div className="mb-8 md:mb-16 flex items-center gap-4">
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

            <h1 className="font-headline text-3xl font-black tracking-tighter sm:text-5xl md:text-6xl">
              SmartSapp Staff Training Session
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-foreground/80">
              This session is designed to get your staff comfortable with the SmartSapp platform. We will cover key features for student management, parent communication, and daily operations.
            </p>

            <div className="my-8 w-full">
               <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-x-6 gap-y-2 text-xl font-semibold mb-4">
                  <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      <span>{format(new Date(meeting.meetingTime), "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span>{format(new Date(meeting.meetingTime), "h:mm a")}</span>
                  </div>
              </div>
              <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
            </div>
            
            <JoinMeetingForm
                meetingId={meeting.id}
                schoolId={school.id}
                meetingLink={meeting.meetingLink || ''}
                meetingTime={meeting.meetingTime || ''}
              />

          </div>

          {/* Right Column */}
          <div className="relative flex items-center justify-center min-h-[280px] md:min-h-[400px] w-full order-first md:order-last">
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

    