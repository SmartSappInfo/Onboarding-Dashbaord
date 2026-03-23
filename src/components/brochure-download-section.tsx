'use client';

import Image from 'next/image';
import LightRays from '@/components/LightRays';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function BrochureDownloadSection({ brochureUrl }: { brochureUrl?: string }) {
  return (
    <section className="relative w-full bg-[#0A1427] text-white py-20 md:py-28 overflow-hidden">
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
      <div className="relative z-10 container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left Column: Brochure Image */}
          <div className="flex justify-center md:justify-end">
            <div className="relative w-[300px] h-[420px] md:w-[350px] md:h-[490px] rounded-lg overflow-hidden shadow-2xl transform transition-transform hover:scale-105">
              <Image
                src="https://picsum.photos/seed/brochure/400/560"
                alt="SmartSapp Brochure"
                fill
                className="object-cover"
                data-ai-hint="brochure cover"
              />
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="text-center md:text-left">
            <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Discover More About SmartSapp
            </h2>
            <p className="text-lg text-gray-200 leading-relaxed mb-8">
              Download our comprehensive brochure to learn more about our features, benefits, and how we are revolutionizing school management and parent engagement.
            </p>
            <Button size="lg" asChild className="px-8 py-6 text-lg" disabled={!brochureUrl}>
              <a href={brochureUrl || '#'} download target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-5 w-5" />
                Download Brochure
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
