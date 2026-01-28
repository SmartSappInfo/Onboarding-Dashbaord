import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getSchoolBySlug } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import CountdownTimer from '@/components/countdown-timer';
import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayCircle, Link as LinkIcon } from 'lucide-react';
import JoinMeetingButton from '@/components/join-meeting-button';

interface PageProps {
  params: {
    schoolName: string;
  };
}

export default async function SchoolOnboardingPage({ params }: PageProps) {
  const school = await getSchoolBySlug(params.schoolName);

  if (!school) {
    notFound();
  }

  const schoolLogo = PlaceHolderImages.find((p) => p.id === school.logoUrlId);
  const heroImage = PlaceHolderImages.find((p) => p.id === school.heroImageUrlId);

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center py-20 text-white md:py-32">
        {heroImage && (
          <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            fill
            className="object-cover"
            data-ai-hint={heroImage.imageHint}
            priority
          />
        )}
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="container relative z-10 px-6 text-center">
          {schoolLogo && (
            <Image
              src={schoolLogo.imageUrl}
              alt={`${school.name} logo`}
              width={100}
              height={100}
              data-ai-hint={schoolLogo.imageHint}
              className="mx-auto mb-6 rounded-full bg-white p-2"
            />
          )}
          <h1 className="mb-2 text-4xl font-black tracking-tight md:text-6xl">{school.name}</h1>
          <p className="mb-8 font-light italic text-gray-200 text-xl md:text-2xl">{school.slogan}</p>
          <div className="my-10">
            <CountdownTimer targetDate={school.meetingTime} />
          </div>
          <JoinMeetingButton meetingTime={school.meetingTime} meetingLink={school.meetingLink} />
        </div>
      </section>

      <div className="container px-6 space-y-24 py-16 md:space-y-32 md:py-24">
        {/* Intro Video Section */}
        <section className="text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Welcome to SmartsApp!</h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-muted-foreground">
            Watch this short video to see how SmartsApp helps bridge the communication gap between school and home.
          </p>
          <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
        </section>

        {/* Download Section */}
        <section className="rounded-lg bg-card p-8 shadow-lg md:p-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Download the App</h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-muted-foreground">
            Get the SmartsApp mobile app to stay connected on the go. Available on all major platforms.
          </p>
          <AppStoreButtons />
        </section>

        {/* Installation Guide Section */}
        <section className="text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">How to Install</h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-muted-foreground">
            Follow this step-by-step video guide to install and set up the SmartsApp on your device.
          </p>
          <VideoEmbed url="https://youtu.be/WJRKrl5S5tM" />
        </section>

        {/* Useful Links Section */}
        <section>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Useful Links & Help Videos</h2>
            <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">
              Quick guides to help you get the most out of SmartsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {school.usefulLinks.map((link) => (
              <a key={link.title} href={link.url} target="_blank" rel="noopener noreferrer" className="group block">
                <Card className="h-full-all duration-300 h-full transition hover:border-primary hover:shadow-xl">
                  <CardHeader>
                    <LinkIcon className="mb-2 h-6 w-6 text-primary" />
                    <CardTitle>{link.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{link.description}</CardDescription>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">What Our Community Says</h2>
            <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">
              Hear from parents and teachers who love using SmartsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {school.testimonials.map((testimonial) => {
              const testimonialImage = PlaceHolderImages.find((p) => p.id === testimonial.imageId);
              return (
                <Card key={testimonial.name} className="overflow-hidden">
                  {testimonialImage && (
                    <div className="relative aspect-video">
                      <Image
                        src={testimonialImage.imageUrl}
                        alt={`Testimonial from ${testimonial.name}`}
                        fill
                        className="object-cover"
                        data-ai-hint={testimonialImage.imageHint}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <a
                          href={testimonial.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Watch testimonial from ${testimonial.name}`}
                        >
                          <PlayCircle className="h-16 w-16 text-white/80 transition-colors hover:text-white" />
                        </a>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{testimonial.name}</CardTitle>
                    <CardDescription>{testimonial.role}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
