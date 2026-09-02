'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Live Simulation Canvas
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Realistic Viewports: macOS Safari window chrome (Desktop) & iPhone 16 Pro frame (Mobile).
 * 2. Independent Lighting Engine: Preview Light/Dark mode without impacting dashboard theme.
 * 3. Interactive Walkthrough: Allows stepping through real questions with keyboard hints.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Monitor,
  Smartphone,
  Layout,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  RotateCcw,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { SmartSappLogo } from '@/components/icons';
import VideoHero from '@/components/video-hero';
import { stripHtml, cn } from '@/lib/utils';
import { MacBrowserFrame } from './preview/MacBrowserFrame';
import { IPhoneFrame } from './preview/IPhoneFrame';
import { SurveyInteractiveWalkthrough } from './preview/SurveyInteractiveWalkthrough';
import type { SimulationDevice, SimulationTheme, SimulationScreen } from './inspector/types';

export default function LivePreviewPane() {
  const { watch } = useFormContext();
  const [device, setDevice] = React.useState<SimulationDevice>('desktop');
  const [themeMode, setThemeMode] = React.useState<SimulationTheme>('sync');
  const [screenMode, setScreenMode] = React.useState<SimulationScreen>('cover');

  const { resolvedTheme } = useTheme();

  const watchedValues = watch();
  const {
    title,
    description,
    slug,
    logoUrl,
    bannerImageUrl,
    videoUrl,
    videoThumbnailUrl,
    videoCaption,
    backgroundColor = '#F8FAFC',
    backgroundPattern = 'none',
    patternColor = '#3B82F6',
    startButtonText,
    showCoverPage,
    showBranding,
    showIntroAsPage = true,
    stepperVariant = 'full',
    elements = [],
  } = watchedValues;

  // Determine active simulation theme
  const isSimulatedDark = React.useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return resolvedTheme === 'dark';
  }, [themeMode, resolvedTheme]);

  const effectiveBgColor = isSimulatedDark ? '#090D16' : (backgroundColor || '#F8FAFC');

  // Background Pattern Renderer
  const BackgroundPattern = () => {
    if (!backgroundPattern || backgroundPattern === 'none') return null;

    return (
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ color: patternColor }}>
        {backgroundPattern === 'dots' && (
          <svg width="100%" height="100%">
            <defs>
              <pattern id="live-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-dots)" />
          </svg>
        )}
        {backgroundPattern === 'grid' && (
          <svg width="100%" height="100%">
            <defs>
              <pattern id="live-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-grid)" />
          </svg>
        )}
        {backgroundPattern === 'circuit' && (
          <svg width="100%" height="100%">
            <defs>
              <pattern id="live-circuit" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 0 30 H 30 V 60 M 30 30 L 60 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="30" cy="30" r="3" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-circuit)" />
          </svg>
        )}
        {backgroundPattern === 'topography' && (
          <svg width="100%" height="100%">
            <defs>
              <pattern id="live-topo" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 0 40 Q 20 20, 40 40 T 80 40 M 0 60 Q 20 40, 40 60 T 80 60" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-topo)" />
          </svg>
        )}
        {backgroundPattern === 'cubes' && (
          <svg width="100%" height="100%">
            <defs>
              <pattern id="live-cubes" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 40 10 L 20 20 L 0 10 Z M 0 10 L 0 30 L 20 40 L 20 20 Z M 40 10 L 40 30 L 20 40" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#live-cubes)" />
          </svg>
        )}
        {backgroundPattern === 'gradient' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
        )}
      </div>
    );
  };

  // Internal Viewport Canvas
  const CanvasContent = (
    <div
      className={cn(
        'w-full h-full relative transition-colors duration-300 overflow-hidden flex flex-col',
        isSimulatedDark ? 'text-slate-100' : 'text-slate-900'
      )}
      style={{ backgroundColor: effectiveBgColor }}
    >
      <BackgroundPattern />

      <ScrollArea className="h-full w-full">
        <div className="p-6 sm:p-10 space-y-8 text-center relative z-10 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[500px]">
          {/* Brand Logo */}
          {showBranding !== false && (
            <div className="flex justify-center shrink-0">
              {logoUrl ? (
                <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                  <img src={logoUrl} alt="Institution Logo" className="object-contain w-full h-full" />
                </div>
              ) : (
                <SmartSappLogo className="h-8" />
              )}
            </div>
          )}

          {/* SCREEN 1: COVER PAGE / HERO */}
          {screenMode === 'cover' && (
            <div className="space-y-8 w-full animate-in fade-in duration-300">
              {/* Video Hero or Cover Banner */}
              {videoUrl ? (
                <div className="w-full">
                  <VideoHero
                    videoUrl={videoUrl}
                    thumbnailUrl={videoThumbnailUrl}
                    title={stripHtml(title || '')}
                    videoCaption={stripHtml(videoCaption || '')}
                  />
                </div>
              ) : bannerImageUrl ? (
                <div className="relative aspect-video rounded-3xl overflow-hidden shadow-xl border-4 border-white/60 bg-card w-full">
                  <img src={bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />
                </div>
              ) : null}

              {/* Title & Prose */}
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  {title || 'Survey Title'}
                </h1>
                <p className="text-sm sm:text-base opacity-80 leading-relaxed font-medium">
                  {description || 'Share your feedback to help us build a better experience for everyone.'}
                </p>
              </div>

              {/* Start Call-to-Action */}
              <div className="pt-2 flex flex-col items-center gap-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setScreenMode('questions')}
                  className="h-13 px-8 rounded-2xl font-bold text-sm shadow-xl gap-2 active:scale-[0.97] transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: patternColor }}
                >
                  <span>{startButtonText || "Let's Start"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <span className="text-[11px] text-muted-foreground/70">Click to preview questions</span>
              </div>
            </div>
          )}

          {/* SCREEN 2: INTERACTIVE QUESTIONS WALKTHROUGH */}
          {screenMode === 'questions' && (
            <div className="w-full">
              <SurveyInteractiveWalkthrough
                elements={elements}
                stepperVariant={stepperVariant}
                accentColor={patternColor}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950/30 rounded-3xl border border-border/80 shadow-inner overflow-hidden animate-in fade-in duration-500">
      {/* Studio Simulation Header Toolbar */}
      <div className="p-3 px-4 border-b border-border/60 bg-background/95 backdrop-blur-sm flex items-center justify-between shrink-0 gap-3">
        {/* Left: Section Title & Screen Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <Layout className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-foreground hidden sm:inline">Live Simulation</span>

          {/* Screen Switcher (Cover vs Questions) */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/50 border border-border/60">
            <button
              type="button"
              onClick={() => setScreenMode('cover')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]',
                screenMode === 'cover'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Cover
            </button>
            <button
              type="button"
              onClick={() => setScreenMode('questions')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]',
                screenMode === 'questions'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Questions
            </button>
          </div>
        </div>

        {/* Right: Lighting Mode & Device Viewport Switcher */}
        <div className="flex items-center gap-2">
          {/* Lighting Mode Selector */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/50 border border-border/60">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              title="Preview in Light Mode"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                themeMode === 'light' ? 'bg-card text-amber-500 shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              title="Preview in Dark Mode"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                themeMode === 'dark' ? 'bg-card text-indigo-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('sync')}
              title="Sync with Dashboard Theme"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                themeMode === 'sync' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Device Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/50 border border-border/60">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              title="Desktop Safari View"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                device === 'desktop' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              title="Mobile iPhone 16 Pro View"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                device === 'mobile' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Viewport Display Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center">
        {device === 'desktop' ? (
          <MacBrowserFrame slug={slug || 'parent-feedback'} className="w-full h-full min-h-[540px]">
            {CanvasContent}
          </MacBrowserFrame>
        ) : (
          <IPhoneFrame>{CanvasContent}</IPhoneFrame>
        )}
      </div>
    </div>
  );
}
