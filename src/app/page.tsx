'use client';

import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/header';
import Footer from '@/components/footer';
import AppDownloadSection from '@/components/app-download-section';
import LightRays from '@/components/LightRays';
import HelpSection from '@/components/help-section';
import SetupProfileSection from '@/components/setup-profile-section';
import TestimonialsSection from '@/components/testimonials-section';

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
            <p className="mx-auto mb-4 text-lg leading-relaxed text-gray-200 md:text-xl">
              Your child's school has signed up on SmartSapp.
              <br />
              Here is a quick video to help you understand what it means for you as a parent.
            </p>
            <p className="mx-auto mb-10 text-lg font-semibold">
              Please watch the full video. It's super important!
            </p>
            <div className="mt-16">
              <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
            </div>
          </div>
        </section>

        <AppDownloadSection />
        
        <SetupProfileSection />

        <HelpSection helpVideos={helpVideos} />

        <TestimonialsSection />
      </main>
      <Footer />
    </>
  );
}
