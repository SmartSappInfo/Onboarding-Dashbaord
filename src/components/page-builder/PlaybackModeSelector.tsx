'use client';

/**
 * @fileOverview PlaybackModeSelector — High-Fidelity Visual Mode Selector
 *
 * Provides an exact, pixel-accurate implementation of the Visual Mode Preview selector
 * featuring miniature browser wireframe thumbnails for "Inline View" and "Lightbox View".
 *
 * Conforms to:
 * - `frontend-design` & `ui-ux-pro-max`: Pixel-precise wireframe miniatures matching design spec.
 * - `emilkowal-animations`: Tactile press micro-interactions (`active:scale-[0.98]`).
 * - Full Accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard arrow traversal with DOM focus sync.
 * - Strict typing: Zero `any`, zero `any[]`.
 */

import React from 'react';
import { Check } from 'lucide-react';
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, targetMode: 'inline' | 'modal') => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(targetMode);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange('modal');
      const container = e.currentTarget.closest('[role="radiogroup"]');
      const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[1]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange('inline');
      const container = e.currentTarget.closest('[role="radiogroup"]');
      const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[0]?.focus();
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5 shadow-2xs select-none",
        className
      )}
    >
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
          VISUAL MODE PREVIEW
        </h4>
      </div>

      {/* 2-Card Visual Radio Group */}
      <div
        role="radiogroup"
        aria-label="Visual Mode Preview"
        className="grid grid-cols-2 gap-3 w-full"
      >
        {/* 1. Inline View Card */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'inline'}
          tabIndex={currentMode === 'inline' ? 0 : -1}
          onClick={() => onChange('inline')}
          onKeyDown={(e) => handleKeyDown(e, 'inline')}
          className={cn(
            "group relative flex flex-col p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[44px]",
            "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
            currentMode === 'inline'
              ? "border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 shadow-sm"
              : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
          )}
        >
          {/* Miniature Browser Wireframe: Inline View */}
          <div className="relative w-full aspect-[16/11] rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col mb-2.5 shadow-2xs">
            {/* Browser Header Bar */}
            <div className="h-5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-2 flex items-center shrink-0">
              {/* Left circular avatar/dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
              {/* Centered address / search pill */}
              <div className="h-2 w-20 sm:w-28 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
            </div>

            {/* Browser Page Body */}
            <div className="flex-1 flex p-2 gap-2 overflow-hidden">
              {/* Sidebar navigation column */}
              <div className="w-[28%] border-r border-slate-200 dark:border-slate-800 pr-1.5 flex flex-col gap-1.5 shrink-0">
                <div className="w-8 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mb-0.5" />
                <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="w-4/5 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="w-5/6 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Main content area */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* Page Title */}
                <div className="w-20 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mb-1" />

                {/* Video player box with adjacent text */}
                <div className="flex items-center gap-1.5">
                  {/* Embedded inline player container */}
                  <div className="w-[58%] aspect-[16/10] rounded-[3px] bg-slate-200/90 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex flex-col justify-between p-1 shadow-2xs shrink-0">
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-0 h-0 border-y-[3.5px] border-y-transparent border-l-[6px] border-l-slate-900 dark:border-l-slate-100 ml-0.5" />
                    </div>
                    {/* Video scrub track */}
                    <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600 rounded-xs flex items-center relative">
                      <div className="w-1/4 h-full bg-slate-800 dark:bg-slate-200 rounded-xs" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100 -ml-0.5 shadow-2xs shrink-0" />
                    </div>
                  </div>

                  {/* Adjacent text paragraph lines */}
                  <div className="flex-1 flex flex-col gap-1 justify-center">
                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="w-3/4 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>

                {/* Text lines continuing below the video */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="w-4/5 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            </div>

            {/* Top-Right Selected Checkmark Badge */}
            {currentMode === 'inline' && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150 z-20">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
            )}
          </div>

          {/* Typography labels */}
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
              Inline View
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal">
              Inline placement
            </span>
          </div>
        </button>

        {/* 2. Lightbox View Card */}
        <button
          type="button"
          role="radio"
          aria-checked={currentMode === 'modal'}
          tabIndex={currentMode === 'modal' ? 0 : -1}
          onClick={() => onChange('modal')}
          onKeyDown={(e) => handleKeyDown(e, 'modal')}
          className={cn(
            "group relative flex flex-col p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[44px]",
            "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
            currentMode === 'modal'
              ? "border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 shadow-sm"
              : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
          )}
        >
          {/* Miniature Browser Wireframe: Lightbox View */}
          <div className="relative w-full aspect-[16/11] rounded-xl border border-slate-700/80 dark:border-slate-700 bg-slate-700 dark:bg-slate-950 overflow-hidden flex flex-col mb-2.5 shadow-2xs">
            {/* Dimmed Browser Header Bar */}
            <div className="h-5 bg-slate-800/80 dark:bg-slate-900/80 border-b border-slate-650 dark:border-slate-800 px-2 flex items-center shrink-0 opacity-50">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
              <div className="h-2 w-20 sm:w-28 rounded-full bg-slate-600 mx-auto" />
            </div>

            {/* Dimmed Background Content */}
            <div className="flex-1 flex p-2 gap-2 overflow-hidden opacity-25 select-none pointer-events-none">
              <div className="w-[28%] border-r border-slate-500/50 pr-1.5 flex flex-col gap-1.5 shrink-0">
                <div className="w-8 h-1.5 rounded-full bg-slate-400 mb-0.5" />
                <div className="w-full h-1 rounded-full bg-slate-400" />
                <div className="w-4/5 h-1 rounded-full bg-slate-400" />
                <div className="w-5/6 h-1 rounded-full bg-slate-400" />
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="w-20 h-1.5 rounded-full bg-slate-400 mb-1" />
                <div className="flex items-center gap-1.5">
                  <div className="w-[58%] aspect-[16/10] rounded-[3px] bg-slate-600 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1 justify-center">
                    <div className="w-full h-1 rounded-full bg-slate-400" />
                    <div className="w-full h-1 rounded-full bg-slate-400" />
                    <div className="w-3/4 h-1 rounded-full bg-slate-400" />
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="w-full h-1 rounded-full bg-slate-400" />
                  <div className="w-4/5 h-1 rounded-full bg-slate-400" />
                </div>
              </div>
            </div>

            {/* Floating Elevated White Lightbox Modal Card */}
            <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
              <div className="w-[74%] aspect-[16/10] rounded-[3px] bg-white shadow-2xl border border-slate-200/60 flex flex-col justify-between p-1.5 transition-transform group-hover:scale-[1.02]">
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-slate-900 ml-0.5" />
                </div>
                {/* Scrub Bar */}
                <div className="w-full h-0.5 bg-slate-200 rounded-xs flex items-center relative">
                  <div className="w-1/5 h-full bg-slate-900 rounded-xs" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-900 -ml-0.5 shadow-2xs shrink-0" />
                </div>
              </div>
            </div>

            {/* Top-Right Selected Checkmark Badge */}
            {currentMode === 'modal' && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150 z-20">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
            )}
          </div>

          {/* Typography labels */}
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
              Lightbox View
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 block font-normal">
              Full-width Lightbox
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-normal leading-snug">
              Video plays in a darkened overlay, maximizing focus.
            </span>
          </div>
        </button>
      </div>

      {/* Bottom Separator Line */}
      <div className="border-b border-slate-100 dark:border-slate-800/80 pt-1" />
    </div>
  );
}
