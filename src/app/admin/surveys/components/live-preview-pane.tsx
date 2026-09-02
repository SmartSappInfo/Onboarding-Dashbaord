'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Live Simulation Canvas
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Realistic Viewports: macOS Safari window chrome (Desktop) & iPhone 16 Pro frame (Mobile).
 * 2. Independent Lighting Engine: Preview Light/Dark mode without impacting dashboard theme.
 * 3. Interactive Walkthrough: Allows stepping through real questions with inline header and responsive buttons.
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
  FlaskConical,
  Eye,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { SmartSappLogo } from '@/components/icons';
import VideoHero from '@/components/video-hero';
import { stripHtml, cn } from '@/lib/utils';
import { MacBrowserFrame } from './preview/MacBrowserFrame';
import { IPhoneFrame } from './preview/IPhoneFrame';
import { SurveyInteractiveWalkthrough } from './preview/SurveyInteractiveWalkthrough';
import { BackgroundPattern } from '@/app/surveys/components/survey-background-pattern';
import type { SimulationDevice, SimulationTheme, SimulationScreen } from './inspector/types';
import type { SurveyExperimentVariant } from '@/lib/types';

export default function LivePreviewPane() {
  const { watch, setValue } = useFormContext();
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
    submitButtonText,
    showCoverPage,
    showBranding,
    showSurveyTitles = true,
    showIntroAsPage = true,
    stepperVariant = 'full',
    elements = [],
    experimentConfig,
    previewVariantId,
  } = watchedValues;

  // A/B Testing Variant Resolver
  const isExperimentActive = !!experimentConfig?.enabled;
  const treatmentVariants: SurveyExperimentVariant[] = (experimentConfig?.variants || []).filter(
    (v: SurveyExperimentVariant) => !v.isControl
  );

  const availableVariants = React.useMemo(() => {
    if (!isExperimentActive) return [];

    const control = {
      id: 'control',
      label: 'Control A',
      fullLabel: 'Control A (Baseline)',
      title: title || 'Survey Title',
      description: description || '',
      startButtonText: startButtonText || "Let's Start",
      submitButtonText: submitButtonText || 'Submit Response',
      isControl: true,
    };

    const treatments = treatmentVariants.map((v, idx) => ({
      id: v.id,
      label: v.label || `Variant ${String.fromCharCode(66 + idx)}`,
      fullLabel: v.label || `Variant ${String.fromCharCode(66 + idx)}`,
      title: v.titleOverride?.trim() ? v.titleOverride : (title || 'Survey Title'),
      description: v.introProseOverride !== undefined && v.introProseOverride !== '' ? v.introProseOverride : (description || ''),
      startButtonText: v.startButtonTextOverride?.trim() ? v.startButtonTextOverride : (startButtonText || "Let's Start"),
      submitButtonText: v.submitButtonTextOverride?.trim() ? v.submitButtonTextOverride : (submitButtonText || 'Submit Response'),
      isControl: false,
    }));

    return [control, ...treatments];
  }, [isExperimentActive, treatmentVariants, title, description, startButtonText, submitButtonText]);

  // Determine active preview variant
  const activeVariantId = previewVariantId || 'control';
  const activeVariant = React.useMemo(() => {
    if (!isExperimentActive || availableVariants.length === 0) return null;
    return availableVariants.find((v) => v.id === activeVariantId) || availableVariants[0];
  }, [isExperimentActive, availableVariants, activeVariantId]);

  // Effective copy values based on active preview variant
  const effectiveTitle = activeVariant ? activeVariant.title : (title || 'Survey Title');
  const effectiveDescription = activeVariant
    ? activeVariant.description
    : (description || 'Share your feedback to help us build a better experience for everyone.');
  const effectiveStartButtonText = activeVariant ? activeVariant.startButtonText : (startButtonText || "Let's Start");
  const effectiveSubmitButtonText = activeVariant ? activeVariant.submitButtonText : (submitButtonText || 'Submit Response');

  // If inline header presentation is active (showIntroAsPage === false), effective screen mode is questions
  const isInlineHeaderActive = showIntroAsPage === false;
  const effectiveScreenMode = isInlineHeaderActive ? 'questions' : screenMode;

  // Determine active simulation theme
  const isSimulatedDark = React.useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return resolvedTheme === 'dark';
  }, [themeMode, resolvedTheme]);

  const effectiveBgColor = isSimulatedDark ? '#090D16' : (backgroundColor || '#F8FAFC');

  // Internal Viewport Canvas
  const CanvasContent = (
    <div
      className={cn(
        'w-full h-full relative transition-colors duration-300 overflow-hidden flex flex-col',
        isSimulatedDark ? 'text-slate-100' : 'text-slate-900'
      )}
      style={{ backgroundColor: effectiveBgColor }}
    >
      <BackgroundPattern pattern={backgroundPattern} color={patternColor} idPrefix="live-pane" />

      {/* A/B Split Test Preview Ribbon */}
      {activeVariant && !activeVariant.isControl && (
        <div className="px-4 py-1.5 bg-purple-500/15 border-b border-purple-500/25 text-purple-800 dark:text-purple-200 text-xs font-bold flex items-center justify-between z-20 shrink-0 shadow-xs">
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span>Previewing Variant Copy: <strong>{activeVariant.label}</strong></span>
          </span>
          <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
            A/B Split Test
          </span>
        </div>
      )}

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

          {/* SCREEN 1: COVER PAGE / HERO (Only when showIntroAsPage is true) */}
          {effectiveScreenMode === 'cover' && (
            <div className="space-y-8 w-full animate-in fade-in duration-300">
              {/* Video Hero or Cover Banner */}
              {videoUrl ? (
                <div className="w-full">
                  <VideoHero
                    videoUrl={videoUrl}
                    thumbnailUrl={videoThumbnailUrl}
                    title={stripHtml(effectiveTitle || '')}
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
                  {effectiveTitle || 'Survey Title'}
                </h1>
                <p className="text-sm sm:text-base opacity-80 leading-relaxed font-medium max-w-lg mx-auto">
                  {effectiveDescription || 'Share your feedback to help us build a better experience for everyone.'}
                </p>
              </div>

              {/* Start Call-to-Action with Proper Button Sizing */}
              <div className="pt-2 flex flex-col items-center gap-2.5">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setScreenMode('questions')}
                  className="h-13 sm:h-14 px-10 sm:px-14 rounded-2xl font-black text-sm sm:text-base shadow-xl gap-3 active:scale-[0.97] transition-all hover:scale-[1.02] text-white"
                  style={{ backgroundColor: patternColor }}
                >
                  <span>{effectiveStartButtonText || "Let's Start"}</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Button>
                <span className="text-[11px] text-muted-foreground/70 font-medium">Click to preview questions</span>
              </div>
            </div>
          )}

          {/* SCREEN 2: INTERACTIVE QUESTIONS WALKTHROUGH (Supports Inline Header Presentation) */}
          {effectiveScreenMode === 'questions' && (
            <div className="w-full">
              <SurveyInteractiveWalkthrough
                elements={elements}
                stepperVariant={stepperVariant}
                accentColor={patternColor}
                showInlineHeader={isInlineHeaderActive}
                showSurveyTitles={showSurveyTitles !== false}
                surveyTitle={effectiveTitle}
                surveyDescription={effectiveDescription}
                submitButtonText={effectiveSubmitButtonText}
                bannerImageUrl={bannerImageUrl}
                videoUrl={videoUrl}
                videoThumbnailUrl={videoThumbnailUrl}
                videoCaption={videoCaption}
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
      <div className="p-3 px-4 border-b border-border/60 bg-background/95 backdrop-blur-sm flex items-center justify-between shrink-0 gap-3 flex-wrap">
        {/* Left: Section Title & Screen Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <Layout className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-foreground hidden sm:inline">Live Simulation</span>

          {/* Screen Switcher (Cover vs Questions vs Inline) */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/50 border border-border/60">
            {isInlineHeaderActive ? (
              <span className="px-3 py-1 rounded-lg text-xs font-bold text-primary bg-card shadow-xs">
                Inline Questions Mode
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setScreenMode('cover')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]',
                    effectiveScreenMode === 'cover'
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
                    effectiveScreenMode === 'questions'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Questions
                </button>
              </>
            )}
          </div>
        </div>

        {/* Middle: A/B Variant Preview Switcher (When A/B testing is active) */}
        {isExperimentActive && availableVariants.length > 0 && (
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-purple-500/10 border border-purple-500/20 shadow-xs">
            <div className="flex items-center gap-1 pl-2 pr-1 text-purple-700 dark:text-purple-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
              <FlaskConical className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />
              <span className="hidden md:inline">Variant:</span>
            </div>
            <div className="flex items-center gap-0.5">
              {availableVariants.map((v) => {
                const isActive = (activeVariant?.id === v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setValue('previewVariantId', v.id, { shouldDirty: true })}
                    className={cn(
                      'px-2 py-0.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1',
                      isActive
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                    )}
                    title={`Preview ${v.fullLabel}`}
                  >
                    <span>{v.label}</span>
                    {v.isControl && (
                      <span className="text-[9px] opacity-75">(A)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Right: Lighting Engine & Device Viewport Selector */}
        <div className="flex items-center gap-2">
          {/* Lighting Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-muted/50 border border-border/60">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              title="Simulation Light Mode"
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
              title="Simulation Dark Mode"
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
              title="Sync with System Theme"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                themeMode === 'sync' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Device Frame Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-muted/50 border border-border/60">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              title="Desktop Browser View"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                device === 'desktop' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              title="iPhone 16 Pro Mobile View"
              className={cn(
                'p-1.5 rounded-lg transition-all active:scale-[0.97]',
                device === 'mobile' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Simulation Stage */}
      <div className="flex-1 overflow-hidden p-3 sm:p-6 flex items-center justify-center">
        {device === 'desktop' ? (
          <MacBrowserFrame
            slug={slug || 'preview'}
            isDark={isSimulatedDark}
            className="w-full h-full max-h-[640px] shadow-2xl"
          >
            {CanvasContent}
          </MacBrowserFrame>
        ) : (
          <IPhoneFrame isDark={isSimulatedDark} className="h-full max-h-[640px] shadow-2xl">
            {CanvasContent}
          </IPhoneFrame>
        )}
      </div>
    </div>
  );
}
