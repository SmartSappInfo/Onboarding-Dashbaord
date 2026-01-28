'use client';

import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/header';
import Footer from '@/components/footer';
import AppDownloadSection from '@/components/app-download-section';
import LightRays from '@/components/LightRays';

export default function Home() {
  const helpVideos = [
    'https://youtu.be/4zchas6SKtE',
    'https://youtu.be/1p5ICDnyzjk',
    'https://youtu.be/XuixxYGw02g',
    'https://youtu.be/qlK8TVipyDs',
    'https://youtu.be/akt0jFWqqPs',
    'https://youtu.be/XmP7rNPSRDc',
    'https://youtu.be/ORUNmDdXMZQ',
    'https://youtu.be/BNJ8jAw3MRE',
    'https://youtu.be/Ft7ViVtzX3U',
  ];

  const testimonials = [
    {
      videoUrl: 'https://youtu.be/sL2S_RzI2nc',
      quote:
        'Knowing only trusted, authorized people can pick up my child brings true peace of mind. SmartSapp ended the chaos and fear I once had at school pick-up.',
    },
    {
      videoUrl: 'https://youtu.be/VrHNh6G1U3k',
      quote:
        'With just a one-tap alert, you can quickly and securely pick up your child. SmartSapp simplifies school routines and ensures only trusted people can access your child—easy and worry-free.',
    },
    {
      videoUrl: 'https://youtu.be/p38wu6iQJ-c',
      quote:
        'SmartSapp gives me peace of mind by notifying me whenever my children are dropped off or picked up, ensuring their security and a smooth pick-up process.',
    },
    {
      videoUrl: 'https://youtu.be/ySSuTA-Bj1Y',
      quote:
        "I know my child is safe, and I can easily update the school if my child is sick or when I'm on my way to pick them up - peace of mind for busy parents",
    },
  ];

  return (
    <>
      <Header />
      <main className="flex-grow">
        <section className="relative flex w-full items-center justify-center overflow-hidden bg-[#0A1427] pt-32 pb-20 text-white md:pt-40 md:pb-24">
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
          <div className="relative z-10 container text-center">
            <h1 className="mb-6 font-headline text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl lg:text-6xl">
              Welcome to the <span className="text-primary">SmartSapp</span> Family
            </h1>
            <p className="mx-auto mb-4 max-w-3xl text-lg leading-relaxed text-gray-200 md:text-xl">
              Your child's school has signed up on SmartSapp.
              <br />
              Here is a quick video to help you understand what it means for you as a parent.
            </p>
            <p className="mx-auto mb-10 max-w-3xl text-lg font-semibold">
              Please watch the full video. It's super important!
            </p>
            <div className="mt-16">
              <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
            </div>
          </div>
        </section>

        <AppDownloadSection />

        <div className="space-y-20 py-20 md:space-y-28 md:py-28">
          <section id="setup-profile" className="container text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              2
            </div>
            <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl">
              How to setup your profile and Confirm your child&apos;s details
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg">
              <a
                href="https://youtu.be/WJRKrl5S5tM"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Here&apos;s a help video
              </a>
            </p>
            <VideoEmbed url="https://youtu.be/WJRKrl5S5tM" />
          </section>

          <section id="support" className="container text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              3
            </div>
            <div className="mx-auto max-w-3xl">
              <p className="mb-6 text-lg text-muted-foreground">
                We try to make everything as seamless and smooth as possible, but
                sometimes things happen. So if you need support with anything or
                want to ask a question about SmartSapp, Please WhatsApp us on{' '}
                <a
                  href="https://wa.me/233501626873"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  +233 50 162 6873
                </a>
                .
              </p>
              <p className="mb-6 text-lg text-muted-foreground">
                We look forward to making it easy for you to be involved with your
                child&apos;s school life.
              </p>
              <p className="text-lg font-semibold text-foreground">
                SmartSapp Team
              </p>
            </div>

            <h2 className="mb-12 mt-16 font-headline text-3xl font-bold md:text-4xl">
              Useful Help Videos
            </h2>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {helpVideos.map((url, index) => (
                <VideoEmbed key={index} url={url} />
              ))}
            </div>
          </section>

          <section id="testimonials" className="container text-center">
            <h2 className="mb-4 font-headline text-3xl font-bold tracking-tight md:text-4xl">
              Why Parents and Schools are going
              <br />
              Wild over SmartSapp
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
              Watch these testimonials to see how parents are ensuring their
              child's security with SmartSapp
            </p>
            <p className="mb-12 text-lg font-semibold">
              👇 Click To Watch These Videos. It&apos;s Super Important👇
            </p>

            <div className="grid grid-cols-1 gap-x-8 gap-y-12 text-left md:grid-cols-2">
              {testimonials.map((testimonial, index) => (
                <Card
                  key={index}
                  className="overflow-hidden shadow-lg"
                >
                  <VideoEmbed url={testimonial.videoUrl} />
                  <CardContent className="p-6">
                    <p className="font-quote italic text-muted-foreground">
                      &quot;{testimonial.quote}&quot;
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
