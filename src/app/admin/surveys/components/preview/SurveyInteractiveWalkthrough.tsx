'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Interactive Survey Step Walkthrough
 * 
 * Supports both standalone question progression and Inline Header Presentation.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Check, Sparkles, CornerDownLeft } from 'lucide-react';
import type { SurveyElement, SurveyQuestion } from '@/lib/types';
import { cn, stripHtml } from '@/lib/utils';
import VideoHero from '@/components/video-hero';

export interface SurveyInteractiveWalkthroughProps {
  elements?: SurveyElement[];
  stepperVariant?: 'full' | 'simple' | 'linear' | 'none';
  accentColor?: string;
  showInlineHeader?: boolean;
  surveyTitle?: string;
  surveyDescription?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  videoCaption?: string;
}

export function SurveyInteractiveWalkthrough({
  elements = [],
  stepperVariant = 'full',
  accentColor = '#3B82F6',
  showInlineHeader = false,
  surveyTitle = 'Survey Title',
  surveyDescription,
  bannerImageUrl,
  videoUrl,
  videoThumbnailUrl,
  videoCaption,
}: SurveyInteractiveWalkthroughProps) {
  // Extract questions from elements
  const questions = React.useMemo(() => {
    const list = elements.filter((el) => el.type !== 'section' && el.type !== 'heading' && el.type !== 'description' && el.type !== 'divider') as unknown as SurveyQuestion[];
    if (list.length > 0) return list;

    // Default sample questions if survey has no questions yet
    return [
      {
        id: 'sample-q1',
        type: 'text',
        title: 'What is your primary email address?',
        description: 'We will use this to send your personalized audit report.',
        isRequired: true,
      },
      {
        id: 'sample-q2',
        type: 'multiple-choice',
        title: 'How would you rate your institutional satisfaction?',
        description: 'Select the option that best describes your experience.',
        options: ['Exceeds Expectations', 'Meets Expectations', 'Needs Improvement'],
        isRequired: true,
      },
    ] as unknown as SurveyQuestion[];
  }, [elements]);

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const currentQuestion = questions[currentIndex] || questions[0];
  const totalQuestions = questions.length;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back for simulation
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const cleanQTitle = stripHtml(currentQuestion?.title || ('text' in currentQuestion ? (currentQuestion as any).text : '') || 'Question Title');
  const cleanQDesc = currentQuestion?.description ? stripHtml(currentQuestion.description) : null;
  const isRequired = currentQuestion?.isRequired || (currentQuestion as any)?.required;

  return (
    <div className="space-y-6 max-w-xl mx-auto text-left animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* INLINE HEADER PRESENTATION (When showIntroAsPage is false) */}
      {showInlineHeader && (
        <div className="p-5 sm:p-6 rounded-3xl bg-card/90 border border-border/80 shadow-md space-y-4 text-center animate-in fade-in slide-in-from-top-3 duration-400">
          {videoUrl ? (
            <div className="w-full">
              <VideoHero
                videoUrl={videoUrl}
                thumbnailUrl={videoThumbnailUrl}
                title={stripHtml(surveyTitle)}
                videoCaption={stripHtml(videoCaption || '')}
              />
            </div>
          ) : bannerImageUrl ? (
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-md border-2 border-white/60 bg-card w-full">
              <img src={bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {surveyTitle || 'Survey Title'}
            </h2>
            {surveyDescription && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                {surveyDescription}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stepper Header Simulation */}
      {stepperVariant !== 'none' && (
        <div className="space-y-2">
          {stepperVariant === 'linear' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                <span>Step {currentIndex + 1} of {totalQuestions}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                />
              </div>
            </div>
          )}

          {stepperVariant === 'simple' && (
            <div className="flex items-center justify-center gap-1.5 py-1">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    idx === currentIndex
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30'
                  )}
                  style={{ backgroundColor: idx === currentIndex ? accentColor : undefined }}
                />
              ))}
            </div>
          )}

          {stepperVariant === 'full' && (
            <div className="flex items-center justify-center gap-3">
              {questions.map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                      idx === currentIndex
                        ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                        : idx < currentIndex
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                    style={{ backgroundColor: idx === currentIndex ? accentColor : undefined }}
                  >
                    {idx < currentIndex ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
                  </div>
                  {idx < totalQuestions - 1 && <div className="w-6 h-[1.5px] bg-border" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question Card */}
      <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/95 backdrop-blur-sm shadow-lg space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-primary">
            <span>Question {currentIndex + 1} of {totalQuestions}</span>
            {isRequired && <span className="text-destructive">*</span>}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
            {cleanQTitle}
          </h3>
          {cleanQDesc && (
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              {cleanQDesc}
            </p>
          )}
        </div>

        {/* Interactive Dummy Input Field */}
        <div className="space-y-3">
          {currentQuestion?.options && currentQuestion.options.length > 0 ? (
            <div className="space-y-2">
              {currentQuestion.options.map((opt: any, i: number) => {
                const optLabel = typeof opt === 'string' ? opt : (opt as { label?: string; text?: string })?.label || (opt as any)?.text || `Option ${i + 1}`;
                return (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-border/70 bg-muted/20 hover:border-primary hover:bg-primary/5 transition-all text-xs font-semibold flex items-center justify-between cursor-pointer active:scale-[0.98]"
                  >
                    <span>{stripHtml(optLabel)}</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                      {i + 1}
                    </kbd>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-12 w-full rounded-xl border border-border/80 bg-background/80 px-4 flex items-center text-xs text-muted-foreground/60 shadow-xs focus-within:ring-2 focus-within:ring-primary/20">
              <span className="font-mono">Type your response here...</span>
            </div>
          )}
        </div>

        {/* Action Controls & Keyboard Hints */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="h-11 px-4 rounded-xl text-xs font-semibold active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Previous
          </Button>

          <Button
            type="button"
            onClick={handleNext}
            className="h-12 px-8 rounded-xl font-bold text-sm shadow-lg gap-2 active:scale-[0.97] transition-all hover:scale-[1.02] text-white"
            style={{ backgroundColor: accentColor }}
          >
            <span>{currentIndex === totalQuestions - 1 ? 'Complete Simulation' : 'Next Step'}</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white">
              <CornerDownLeft className="h-2.5 w-2.5" />
            </kbd>
          </Button>
        </div>
      </Card>
    </div>
  );
}
