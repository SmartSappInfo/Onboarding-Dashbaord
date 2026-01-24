import Image from 'next/image';
import type { School } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import CountdownTimer from '@/components/countdown-timer';
import JoinMeetingButton from '@/components/join-meeting-button';

interface MeetingHeroProps {
  school: School;
}

export default function MeetingHero({ school }: MeetingHeroProps) {
  const schoolLogo = PlaceHolderImages.find((p) => p.id === school.logoUrlId);
  const heroImage = PlaceHolderImages.find((p) => p.id === school.heroImageUrlId);

  return (
    <section className="w-full bg-background px-4 py-10 md:py-20">
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 md:grid-cols-2 lg:gap-20">
        {/* Left Column */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          
          {schoolLogo && (
            <div className="mb-6 flex items-center gap-4">
              <Image
                src={schoolLogo.imageUrl}
                alt={`${school.name} logo`}
                width={64}
                height={64}
                data-ai-hint={schoolLogo.imageHint}
                className="rounded-full bg-white p-1 shadow-md"
              />
              <div>
                <h2 className="text-2xl font-bold">{school.name}</h2>
                {school.slogan && <p className="text-muted-foreground">{school.slogan}</p>}
              </div>
            </div>
          )}

          <h1 className="font-headline text-3xl font-black tracking-tight text-primary sm:text-4xl md:text-5xl">
            {school.name} is digitalizing to serve you better
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Join us for a short onboarding session where we’ll show you how SmartSapp improves communication, payments, and school engagement for parents.
          </p>

          <div className="my-10 w-full max-w-lg">
            <CountdownTimer targetDate={school.meetingTime} />
          </div>
          
          <div className="w-full md:w-auto">
            <JoinMeetingButton meetingTime={school.meetingTime} meetingLink={school.meetingLink} />
          </div>

        </div>

        {/* Right Column */}
        <div className="relative h-80 w-full rounded-xl shadow-2xl md:h-[500px] order-first md:order-last">
          {heroImage && (
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              fill
              className="rounded-xl object-cover"
              data-ai-hint={heroImage.imageHint}
              priority
            />
          )}
           <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      </div>
    </section>
  );
}
