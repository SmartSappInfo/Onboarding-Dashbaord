'use client';

import Image from 'next/image';
import type { School, Meeting } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import JoinMeetingButton from '@/components/join-meeting-button';

interface MeetingHeroProps {
  school: School;
  meeting: Meeting;
}

export default function MeetingHero({ school, meeting }: MeetingHeroProps) {

  return (
    <section className="w-full bg-blue-600 text-white px-4 py-10 md:py-20 overflow-hidden">
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 md:grid-cols-2 lg:gap-20">
        
        {/* Left Column */}
        <div className="flex flex-col justify-center items-center text-center md:items-start md:text-left z-10">
          
          {school.logoUrl && (
            <div className="mb-6 flex items-center gap-4">
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
                {school.slogan && <p className="text-white/80">{school.slogan}</p>}
              </div>
            </div>
          )}

          <h1 className="font-headline text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            {school.name} is digitalizing to serve you better
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/80">
            Join us for a short onboarding session where we’ll show you how SmartSapp improves communication, payments, and school engagement for parents.
          </p>

          <div className="my-10 w-full max-w-lg">
            <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
          </div>
          
          <div className="w-full md:w-auto">
            <JoinMeetingButton meetingTime={meeting.meetingTime || ''} meetingLink={meeting.meetingLink || ''} />
          </div>

        </div>

        {/* Right Column */}
        <div className="relative flex items-center justify-center min-h-[400px] w-full order-first md:order-last">
            <div className="relative flex items-center justify-center">
                {/* Decorative circles */}
                <div className="absolute w-[250px] h-[250px] md:w-[350px] md:h-[350px] rounded-full border-2 border-white/10 animate-pulse"></div>
                <div className="absolute w-[350px] h-[350px] md:w-[450px] md:h-[450px] rounded-full border border-white/5"></div>
                <div className="absolute w-[450px] h-[450px] md:w-[550px] md:h-[550px] rounded-full border border-white/5 animate-pulse delay-500"></div>

                 {/* Pink circle behind the image */}
                 <div className="absolute w-[200px] h-[200px] md:w-[300px] md:h-[300px] rounded-full bg-pink-500/30 blur-3xl"></div>

                {/* Image */}
                {school.heroImageUrl ? (
                    <Image
                        src={school.heroImageUrl}
                        alt={`Hero image for ${school.name}`}
                        width={320}
                        height={320}
                        className="relative object-contain"
                        priority
                    />
                ) : (
                    <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/10">
                         <span className="text-white/50">No Image</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </section>
  );
}
