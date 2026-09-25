'use client';

/**
 * @fileOverview PlaybackModeSelector — High-Fidelity Visual Mode Selector
 *
 * Replaces generic dropdown selects with an intuitive, visual 2-card selector
 * providing clear mental models for "Play Inline" vs "Popup Modal" video playback.
 *
 * Conforms to:
 * - `frontend-design` & `ui-ux-pro-max`: Visual mini-wireframe cards with clear affordances.
 * - `emilkowal-animations`: Tactile press micro-interactions (`active:scale-[0.98]`).
 * - Accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, full keyboard navigation.
 * - Strict typing: Zero `any`, zero `any[]`.
 */

import React from 'react';
import { Play, CheckCircle2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlaybackModeSelectorProps {
  value?: string;
  onChange: (value: 'inline' | 'modal') => void;
  className?: string;
}

export function PlaybackModeSelector({
  value = 'inline',
  onChange,
  className
}: PlaybackModeSelectorProps) {
  const currentMode = value === 'modal' ? 'modal' : 'inline';

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* 2-Card Visual Radio Group */}
      <div
        role="radiogroup"
        aria-label="Video Playback Mode"
        className="grid grid-cols-2 gap-2 w-full select-none"
      >
        {/* 1. Play Inline Option */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'inline'}
          tabIndex={0}
          onClick={() => onChange('inline')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('inline');
            }
          }}
          className={cn(
            "relative flex flex-col p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[105px]",
            "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
            currentMode === 'inline'
              ? "bg-primary/[0.04] dark:bg-primary/[0.08] border-primary shadow-xs ring-1 ring-primary/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
          )}
        >
          {/* Mini Wireframe: Inline Embedded Player */}
          <div className="w-full h-11 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 p-1 flex flex-col justify-between overflow-hidden mb-2">
            <div className="w-1/3 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
            <div className="w-full h-5.5 rounded bg-primary/15 dark:bg-primary/25 border border-primary/30 flex items-center justify-center">
              <Play className="w-2.5 h-2.5 text-primary fill-primary" />
            </div>
            <div className="w-2/3 h-1 bg-slate-200 dark:bg-slate-700/60 rounded-full" />
          </div>

          {/* Label & Indicator */}
          <div className="flex items-center justify-between gap-1 w-full">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Play Inline
            </span>
            {currentMode === 'inline' && (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 animate-in zoom-in-75 duration-150" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
            Embeds in page section
          </span>
        </button>

        {/* 2. Pop-up Modal Option */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'modal'}
          tabIndex={0}
          onClick={() => onChange('modal')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('modal');
            }
          }}
          className={cn(
            "relative flex flex-col p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[105px]",
            "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
            currentMode === 'modal'
              ? "bg-primary/[0.04] dark:bg-primary/[0.08] border-primary shadow-xs ring-1 ring-primary/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
          )}
        >
          {/* Mini Wireframe: Dark Lightbox Modal Overlay */}
          <div className="w-full h-11 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800 p-1 flex items-center justify-center relative overflow-hidden mb-2 shadow-inner">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />
            {/* Centered Floating Modal Card */}
            <div className="relative z-10 w-4/5 h-7 rounded bg-slate-800 dark:bg-slate-900 border border-primary/50 shadow-md flex items-center justify-center">
              <Play className="w-2.5 h-2.5 text-primary fill-primary" />
            </div>
          </div>

          {/* Label & Indicator */}
          <div className="flex items-center justify-between gap-1 w-full">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Popup Modal
            </span>
            {currentMode === 'modal' && (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 animate-in zoom-in-75 duration-150" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
            Cinematic dark lightbox
          </span>
        </button>
      </div>

      {/* Dynamic Contextual Helper Micro-copy */}
      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span className="leading-tight">
          {currentMode === 'inline' ? (
            <>
              <strong className="text-slate-800 dark:text-slate-200">Inline:</strong> The video starts playing directly in the content container when clicked, keeping visitors in the reading flow.
            </>
          ) : (
            <>
              <strong className="text-slate-800 dark:text-slate-200">Popup Modal:</strong> The page dims into a focused, distraction-free theater view when clicked, great for key landing page demos.
            </>
          )}
        </span>
      </div>
    </div>
  );
}
