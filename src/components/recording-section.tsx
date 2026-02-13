'use client';

import VideoEmbed from '@/components/video-embed';
import LightRays from '@/components/LightRays';

interface RecordingSectionProps {
  recordingUrl: string;
}

export default function RecordingSection({ recordingUrl }: RecordingSectionProps) {
  return (
    <section id="recording" className="relative bg-[#0A1427] text-white py-16 md:py-24 overflow-hidden">
      <LightRays
        raysOrigin="top-center"
        raysColor="#3B5FFF"
        raysSpeed={0.8}
        lightSpread={0.4}
        rayLength={2.5}
        followMouse={false}
        mouseInfluence={0}
        noiseAmount={0}
        distortion={0}
        pulsating
        fadeDistance={0.8}
        saturation={1}
        className="!absolute inset-0 opacity-70"
      />
      <div className="container relative z-10 text-center">
        <h2 className="mb-3 font-headline text-3xl font-bold tracking-tight md:text-4xl">
          Watch the Meeting Recording
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-200">
          If you missed the session or want to review the information, you can watch the full recording below.
        </p>
        <div className="mx-auto max-w-4xl">
            <VideoEmbed url={recordingUrl} />
        </div>
      </div>
    </section>
  );
}
