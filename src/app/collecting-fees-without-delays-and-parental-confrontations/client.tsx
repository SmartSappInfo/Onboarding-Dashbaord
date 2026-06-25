'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Play } from 'lucide-react';

const CUSTOM_THUMBNAIL_URL =
  'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782385064904-Thumbnails.webp?alt=media&token=f40892b1-4b9e-4988-8304-e42fc0711aba';
const YOUTUBE_VIDEO_ID = '8xhxALYfNDc';
const CTA_LINK = 'https://smartsapp.com/request-trial';

export default function CollectingFeesClient() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="light min-h-screen bg-white font-body selection:bg-primary/10 text-slate-900">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-400/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 py-6 px-6 sm:px-10 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="transition-transform hover:scale-105 duration-300">
            <Logo className="h-10" />
          </Link>
          <div className="hidden sm:block">
            <Button variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5" asChild>
              <Link href={CTA_LINK}>Request Demo</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center">
        {/* Hero Section */}
        <div className="space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            How we collect fees{' '}
            <span className="text-primary italic">&lt;without delays&gt;</span>
            {' '}and Parental Confrontations
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            Fee collection used to bring stress. SmartSapp changed it. No gate issues. Payments feel smooth.
          </p>
        </div>

        {/* Video Section — custom thumbnail */}
        <div className="relative rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-8 border-white animate-in fade-in zoom-in-95 duration-1000 delay-300 fill-mode-both">
          {!isPlaying ? (
            <div
              className="relative aspect-video w-full cursor-pointer group bg-slate-900"
              onClick={() => setIsPlaying(true)}
            >
              <Image
                src={CUSTOM_THUMBNAIL_URL}
                alt="Video thumbnail — How we collect fees without delays and parental confrontations"
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
              />

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                  <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse" />
                  <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(59,95,255,0.6)]">
                    <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                  </div>
                </div>
              </div>

              {/* Hover label */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-current" />
                </div>
                <p className="text-white font-bold text-lg sm:text-xl drop-shadow-lg">Click to Play Video</p>
              </div>
            </div>
          ) : (
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-16 sm:mt-24 space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500 fill-mode-both">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-slate-900">
            Want to collect your fees without stress and{' '}
            <span className="text-primary">parental confrontations?</span>
          </h2>

          <p className="text-lg sm:text-xl text-slate-600 font-medium">
            Book a FREE 30-minutes consultation to see your personalized roadmap to complete the shift.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-primary text-white text-lg font-bold shadow-[0_12px_24px_-8px_rgba(59,95,255,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(59,95,255,0.5)] hover:translate-y--1 transition-all duration-300 group"
              asChild
            >
              <Link href={CTA_LINK} className="flex items-center justify-center gap-2">
                Book Free Consultation Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Personalized Roadmap</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Complete the shift</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-12 px-6 text-center border-t border-gray-100 mt-20">
        <p className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} SmartSapp. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
