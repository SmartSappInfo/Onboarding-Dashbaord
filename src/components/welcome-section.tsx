'use client';

import VideoEmbed from '@/components/video-embed';
import LightRays from '@/components/LightRays';

export default function WelcomeSection() {
  return (
    <section className="relative w-full bg-background text-foreground pt-32 pb-20 md:pt-40 md:pb-24 min-h-screen flex items-center overflow-hidden">
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
      <div className="container relative z-10 text-center">
        <h1 className="mb-6 font-headline text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl lg:text-6xl">
          Welcome to the <span className="text-primary">SmartSapp</span> Family
        </h1>
        <p className="mb-4 text-lg leading-relaxed text-foreground/80">
          Your child's school has signed up on SmartSapp.
          <br />
          Here is a quick video to help you understand what it means for you as a parent.
        </p>
        <p className="mb-10 text-lg font-semibold text-foreground">
          Please watch the full video. It's super important!
        </p>
        <div className="mx-auto max-w-[60%]">
            <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
        </div>
      </div>
    </section>
  );
}
