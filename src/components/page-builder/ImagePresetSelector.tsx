'use client';

/**
 * @fileOverview ImagePresetSelector — 1-Click Miniature Wireframe Image Preset Picker
 *
 * Displays 8 distinct image presets with miniature WYSIWYG wireframes:
 * 1. Clean Card (Soft rounded corners, hairline border)
 * 2. Browser Mockup (Desktop window frame with 3 dots & address bar)
 * 3. Mobile Chassis (Smartphone bezel with top speaker pill)
 * 4. Cathedral Arch (Editorial dome arched top mask)
 * 5. Circular Avatar (1:1 circular badge silhouette)
 * 6. Floating Elevated (Multi-tiered diffuse drop shadow)
 * 7. Interactive Zoom (Hover scale-105 visual cue)
 * 8. Neo-Brutalist (Sharp 0px edges, 2px border, hard offset shadow)
 *
 * Standards:
 * - Mobile accessibility with min-h-[44px] targets (min-h-[92px]).
 * - ARIA radiogroup and radio semantics.
 * - Tactile micro-interactions (active:scale-[0.98]).
 * - Strict typing with zero any.
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImagePresetOption {
  value: string;
  label: string;
}

export interface ImagePresetSelectorProps {
  value?: string;
  options: ReadonlyArray<ImagePresetOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature WYSIWYG preview wireframes for all 8 image presets.
 */
function renderImageMiniaturePreview(presetKey: string) {
  switch (presetKey) {
    case 'clean-card':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-16 h-10 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center">
            <div className="w-5 h-5 rounded-xs bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            </div>
          </div>
        </div>
      );

    case 'browser-mockup':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-18 h-11 rounded-t-sm rounded-b-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs flex flex-col overflow-hidden">
            {/* Browser Header Bar */}
            <div className="h-3 bg-slate-200 dark:bg-slate-700/80 px-1 flex items-center gap-0.5 border-b border-slate-300/70 dark:border-slate-700">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <div className="w-8 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1" />
            </div>
            {/* Viewport */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-850 flex items-center justify-center">
              <div className="w-6 h-3 bg-slate-200 dark:bg-slate-700 rounded-xs" />
            </div>
          </div>
        </div>
      );

    case 'mobile-chassis':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-8 h-12 rounded-lg bg-white dark:bg-slate-800 border-2 border-slate-700 dark:border-slate-600 shadow-xs flex flex-col items-center overflow-hidden">
            {/* Speaker bar */}
            <div className="w-2.5 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1 mb-0.5" />
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center p-0.5">
              <div className="w-5 h-6 rounded-xs bg-slate-300 dark:bg-slate-700" />
            </div>
          </div>
        </div>
      );

    case 'cathedral-arch':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-11 h-12 rounded-t-full rounded-b-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs flex flex-col items-center justify-center overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 mt-2" />
          </div>
        </div>
      );

    case 'circular-avatar':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border-2 border-primary/40 shadow-xs flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        </div>
      );

    case 'floating-elevated':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-15 h-9 rounded-md bg-white dark:bg-slate-800 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.22)] -translate-y-0.5 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
            <div className="w-7 h-4 bg-slate-200 dark:bg-slate-700 rounded-xs" />
          </div>
        </div>
      );

    case 'interactive-zoom':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-16 h-10 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <div className="w-10 h-7 bg-blue-500/20 rounded-xs flex items-center justify-center">
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">ZOOM</span>
            </div>
          </div>
        </div>
      );

    case 'neo-brutalist':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-15 h-9 bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] flex items-center justify-center">
            <div className="w-7 h-4 bg-amber-400/40 border border-slate-900 dark:border-white" />
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-14 h-9 rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>
      );
  }
}

export function ImagePresetSelector({
  value,
  options,
  onChange,
  className,
}: ImagePresetSelectorProps) {
  const currentVal = value || options[0]?.value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(options[currentIndex].value);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      onChange(options[nextIdx].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIdx].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Image Preset Style"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe Thumbnail Container */}
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderImageMiniaturePreview(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Preset Label */}
            <div className="px-0.5 w-full">
              <span
                className={cn(
                  "text-[11px] font-bold leading-tight block truncate",
                  isSelected
                    ? "text-primary dark:text-primary font-black"
                    : "text-slate-800 dark:text-slate-200 group-hover:text-foreground"
                )}
                title={opt.label}
              >
                {opt.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
