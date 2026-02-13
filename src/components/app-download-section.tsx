'use client';

import AppStoreButtons from '@/components/app-store-buttons';
import ScrollDownIndicator from './scroll-down-indicator';

export default function AppDownloadSection() {
  return (
    <section id="download" className="relative py-20 text-center text-white overflow-hidden md:py-28">
      <div
        className="absolute inset-0 z-[-2]"
        style={{
          backgroundImage: `url(https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/daughter-father-looking-video-phone-ezgif.com-jpg-to-webp-converter.webp?alt=media&token=2b83185a-a33a-424f-b2ea-f69b00cff95b)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />
      <div className="absolute inset-0 bg-[#0A1427]/80 z-[-1]"></div>
      <div className="container relative">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          1
        </div>
        <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl">
          Want to get Started?
        </h2>
        <p className="mb-6 text-lg text-gray-200">
          You can download SmartSapp below by clicking the icon that applies
          to your phone type
        </p>
        <p className="mb-10">
          <a
            href="#download-links"
            className="font-semibold text-white hover:underline"
          >
            Click To Download Now!
          </a>
        </p>
        <div id="download-links" className="flex justify-center">
          <AppStoreButtons />
        </div>
      </div>
      <ScrollDownIndicator href="#setup-profile" />
    </section>
  );
}
