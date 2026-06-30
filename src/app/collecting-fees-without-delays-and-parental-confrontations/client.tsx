'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Play, RotateCcw, Sparkles } from 'lucide-react';
import { usePageAnalytics } from '@/hooks/use-page-analytics';
import { PageAnalyticsReader } from '@/components/page-analytics-reader';
import type { PageEventChannel } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ResizableIFrame } from '@/components/ui/ResizableIFrame';

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOM_THUMBNAIL_URL =
  'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782385064904-Thumbnails.webp?alt=media&token=f40892b1-4b9e-4988-8304-e42fc0711aba';
const YOUTUBE_VIDEO_ID = '8xhxALYfNDc';
const CTA_LINK = 'https://smartsapp.com/request-trial';
const PAGE_SLUG = 'collecting-fees-without-delays-and-parental-confrontations';

type VideoState = 'idle' | 'playing' | 'finished';

// ─── YouTube IFrame API types (strict — no `any`) ─────────────────────────────

interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars: {
    autoplay: 0 | 1;
    rel: 0 | 1;
    modestbranding: 0 | 1;
    enablejsapi: 0 | 1;
  };
  events: {
    onStateChange: (event: YTPlayerEvent) => void;
  };
}

interface YTPlayer {
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CollectingFeesClient() {
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  // Tracks the active channel so we can tag all events after the first detection
  const channelRef = useRef<PageEventChannel>('direct');

  const { track, setEntityId, hasFiredVideoStart } = usePageAnalytics(PAGE_SLUG);

  // ── Analytics: fire page_view once on mount (after channel/entity are set) ──
  // page_view fires in onReady from PageAnalyticsReader to ensure channel is known
  const handleReady = useCallback(
    (channel: PageEventChannel) => {
      channelRef.current = channel;
      track('page_view', channel);
    },
    [track]
  );

  const handleEntityDetected = useCallback(
    (entityId: string, channel: PageEventChannel) => {
      setEntityId(entityId);
      channelRef.current = channel;
    },
    [setEntityId]
  );

  // ── YouTube IFrame API ────────────────────────────────────────────────────────

  useEffect(() => {
    if (videoState !== 'playing') return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, enablejsapi: 1 },
        events: {
          onStateChange: (event: YTPlayerEvent) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              setVideoState('finished');
              track('video_complete', channelRef.current);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoState, track]);

  // ── Interaction handlers ──────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    setVideoState('playing');
    if (!hasFiredVideoStart.current) {
      hasFiredVideoStart.current = true;
      track('video_start', channelRef.current);
    }
  }, [track, hasFiredVideoStart]);

  const handleReplay = useCallback(() => {
    setVideoState('playing');
    track('video_replay', channelRef.current);
  }, [track]);

  const handleCtaClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsSurveyModalOpen(true);
    track('cta_click', channelRef.current);
  }, [track]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="light min-h-screen bg-white font-body selection:bg-primary/10 text-slate-900"
      style={{ colorScheme: 'light' }}
    >
      {/*
        PageAnalyticsReader must be inside <Suspense> because useSearchParams()
        causes a CSR bailout without it (next-best-practices/suspense-boundaries).
        fallback={null} → zero visible flash; the reader renders nothing to the DOM.
      */}
      <Suspense fallback={null}>
        <PageAnalyticsReader
          onEntityDetected={handleEntityDetected}
          onReady={handleReady}
        />
      </Suspense>

      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-400/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      {/* Header — rounded pill nav */}
      <header className="sticky top-0 z-50 w-full py-4">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between rounded-full bg-white/90 backdrop-blur-md border border-primary/10 shadow-[0_4px_24px_-4px_rgba(59,95,255,0.12)] py-2 pl-5 pr-2">
            <Link href="/" className="transition-transform hover:scale-105 duration-300" aria-label="Back to homepage">
              <Logo variant="primary" className="h-9" />
            </Link>
            <Button
              className="rounded-full bg-[#3B5FFF] text-white font-semibold hover:bg-[#2d4ef0] px-5 h-10 shadow-none transition-all"
              onClick={handleCtaClick}
            >
              Book Free Consultation
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center">
        {/* Hero Section */}
        <div className="space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            How we collect fees{' '}
            <span className="text-primary italic">without delays</span>
            {' '}and Parental Confrontations
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            Fee collection used to bring stress. SmartSapp changed it. No gate issues. Payments feel smooth.
          </p>
        </div>

        {/* Video Section */}
        <div className="relative rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-8 border-white animate-in fade-in zoom-in-95 duration-1000 delay-300 fill-mode-both">

          {/* ── IDLE: thumbnail + play button ── */}
          {videoState === 'idle' && (
            <div
              className="relative aspect-video w-full cursor-pointer group bg-slate-900"
              onClick={handlePlay}
              role="button"
              tabIndex={0}
              aria-label="Play video: How we collect fees without delays and parental confrontations"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlay(); }}
            >
              <Image
                src={CUSTOM_THUMBNAIL_URL}
                alt="Video thumbnail — How we collect fees without delays and parental confrontations"
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#3B5FFF]/30 animate-ping" />
                  <div className="absolute -inset-4 rounded-full bg-[#3B5FFF]/20 animate-pulse" />
                  <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-[#3B5FFF] text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(59,95,255,0.6)]">
                    <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-current" />
                </div>
                <p className="text-white font-bold text-lg sm:text-xl drop-shadow-lg">Click to Play Video</p>
              </div>
            </div>
          )}

          {/* ── PLAYING: YouTube IFrame API player ── */}
          {videoState === 'playing' && (
            <div className="aspect-video w-full bg-black">
              <div id="yt-player" className="w-full h-full" />
            </div>
          )}

          {/* ── FINISHED: post-video CTA overlay ── */}
          {videoState === 'finished' && (
            <div className="relative aspect-video w-full bg-gradient-to-br from-[#0f1f6e] via-[#1a2f9e] to-[#3B5FFF] flex flex-col items-center justify-center text-center px-6 gap-6 animate-in fade-in zoom-in-95 duration-700">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-[#3B5FFF]/40 rounded-full blur-2xl" />
              </div>

              <div className="relative z-10 space-y-3 max-w-lg">
                <div className="flex items-center justify-center gap-2 text-white/70 text-sm font-semibold uppercase tracking-widest mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>You just watched a real success story</span>
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  This could be <span className="text-yellow-300">your story!</span>
                </h3>
                <p className="text-white/80 text-base sm:text-lg font-medium">
                  Do you want to make <span className="text-white font-bold">full collection</span> next term?
                </p>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3">
                <Button
                  size="lg"
                  className="rounded-2xl bg-white text-[#3B5FFF] font-bold hover:bg-white/90 px-6 h-12 text-base shadow-[0_8px_24px_-4px_rgba(0,0,0,0.3)] transition-all hover:scale-105 group"
                  onClick={handleCtaClick}
                >
                  <span className="flex items-center gap-2">
                    Request Free Consultation
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-2xl border-white/30 text-white font-semibold hover:bg-white/10 px-6 h-12 text-base backdrop-blur-sm transition-all"
                  onClick={handleReplay}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Replay Video
                </Button>
              </div>
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
              className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-[#3B5FFF] text-white text-lg font-bold shadow-[0_12px_24px_-8px_rgba(59,95,255,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(59,95,255,0.5)] transition-all duration-300 group"
              onClick={handleCtaClick}
            >
              <span className="flex items-center justify-center gap-2">
                Book Free Consultation Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
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

      <Dialog open={isSurveyModalOpen} onOpenChange={setIsSurveyModalOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-4xl md:max-w-5xl w-[95vw] md:w-full p-1 overflow-hidden bg-white border border-slate-200/80 rounded-3xl"
        >
          <DialogTitle className="sr-only">Book Free Consultation Survey</DialogTitle>
          <DialogDescription className="sr-only">
            Please fill out this quick survey to book your free consultation.
          </DialogDescription>
          {isSurveyModalOpen && (
            <ResizableIFrame
              src="/surveys/collect-your-fees-within-4-weeks-of-reopening?embed=true&theme=light"
              slug="collect-your-fees-within-4-weeks-of-reopening"
              fallbackHeight={720}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
