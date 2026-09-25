'use client';

/**
 * @fileOverview PresetStyleSelector — Visual Miniature Preset Style Picker
 *
 * Displays preset styles as interactive thumbnail cards with exact miniature WYSIWYG
 * visual previews of each layout and typographic style.
 *
 * Features:
 * - High-fidelity miniature wireframe previews for every preset.
 * - Tactile micro-interactions (`active:scale-[0.98]`).
 * - Full accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard navigation.
 * - Responsive 2-column card grid with selection rings and checkmark indicators.
 * - Strict typing: zero `any`, zero `any[]`.
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PresetOption {
  value: string;
  label: string;
}

export interface PresetStyleSelectorProps {
  value?: string;
  options: ReadonlyArray<PresetOption>;
  blockType?: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders an exact miniature visual representation of each preset style.
 */
function renderMiniaturePreview(presetKey: string) {
  switch (presetKey) {
    // === Title Block Presets ===
    case 'hero-title':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-100 dark:bg-slate-900">
          <div className="w-10 h-1.5 bg-blue-500 rounded-full mb-1.5" />
          <div className="w-20 h-2 bg-slate-900 dark:bg-white rounded-xs mb-1" />
          <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-xs mb-1.5" />
          <div className="w-24 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full" />
        </div>
      );

    case 'section-heading':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-100 dark:bg-slate-900">
          <div className="w-8 h-1 bg-emerald-500 rounded-full mb-1.5" />
          <div className="w-18 h-2 bg-slate-900 dark:bg-white rounded-xs mb-1" />
          <div className="w-22 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full" />
        </div>
      );

    case 'left-accent-border':
      return (
        <div className="w-full h-full flex items-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-1 h-9 bg-blue-600 dark:bg-blue-500 rounded-full mr-2 shrink-0" />
          <div className="flex flex-col gap-1 w-full text-left">
            <div className="w-8 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
            <div className="w-16 h-2 bg-slate-900 dark:bg-white rounded-xs" />
            <div className="w-20 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    case 'elegant-serif':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-100 dark:bg-slate-900">
          <div className="w-10 h-0.5 bg-amber-500/80 rounded-full mb-1" />
          <span className="text-[11px] italic font-serif text-slate-900 dark:text-white leading-none font-bold">
            Editorial Serif
          </span>
          <div className="w-16 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full mt-1.5" />
        </div>
      );

    case 'badge-capsule':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-1.5 shadow-2xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="w-12 h-1.5 bg-emerald-700 dark:bg-emerald-300 rounded-full" />
          </div>
        </div>
      );

    case 'subtitle':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-100 dark:bg-slate-900">
          <div className="w-20 h-1.5 bg-slate-600 dark:bg-slate-300 rounded-full mb-1" />
          <div className="w-16 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full mb-1" />
          <div className="w-12 h-1 bg-slate-400/50 dark:bg-slate-600 rounded-full" />
        </div>
      );

    case 'accent-tagline':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 text-center bg-slate-100 dark:bg-slate-900">
          <div className="w-20 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full" />
        </div>
      );

    // === Text Block Presets ===
    case 'lead':
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-22 h-2 bg-slate-900 dark:bg-white rounded-xs mb-1" />
          <div className="w-20 h-2 bg-slate-800 dark:bg-slate-200 rounded-xs mb-1" />
          <div className="w-14 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full" />
        </div>
      );

    case 'disclaimer':
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-20 h-1 bg-slate-400 dark:bg-slate-500 rounded-full mb-1" />
          <div className="w-24 h-1 bg-slate-400/80 dark:bg-slate-500/80 rounded-full mb-1" />
          <div className="w-16 h-0.5 bg-slate-400/60 dark:bg-slate-600 rounded-full" />
        </div>
      );

    case 'two-columns':
      return (
        <div className="w-full h-full grid grid-cols-2 gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex flex-col justify-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-1">
            <div className="w-full h-1.5 bg-slate-700 dark:bg-slate-300 rounded-full" />
            <div className="w-3/4 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          </div>
          <div className="flex flex-col justify-center gap-1 pl-0.5">
            <div className="w-full h-1.5 bg-slate-700 dark:bg-slate-300 rounded-full" />
            <div className="w-3/4 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    case 'checklist':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-xs bg-emerald-500 shrink-0" />
            <div className="w-18 h-1 bg-slate-700 dark:bg-slate-300 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-xs bg-emerald-500 shrink-0" />
            <div className="w-14 h-1 bg-slate-700 dark:bg-slate-300 rounded-full" />
          </div>
        </div>
      );

    case 'quote':
      return (
        <div className="w-full h-full flex items-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-1 h-8 bg-amber-500 rounded-full mr-2 shrink-0" />
          <div className="flex flex-col gap-1 w-full text-left">
            <div className="w-18 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-xs italic" />
            <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    // === Testimonial Presets ===
    case 'standard':
      return (
        <div className="w-full h-full flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
          <div className="flex flex-col gap-1 w-full">
            <div className="w-20 h-1.5 bg-slate-700 dark:bg-slate-300 rounded-full" />
            <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    case 'split-video':
      return (
        <div className="w-full h-full grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="rounded-md bg-slate-800 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white/80 flex items-center justify-center">
              <div className="w-0 h-0 border-y-[2px] border-y-transparent border-l-[4px] border-l-slate-900 ml-0.5" />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1">
            <div className="w-full h-1.5 bg-slate-700 dark:bg-slate-300 rounded-full" />
            <div className="w-3/4 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    case 'horizontal-dark':
      return (
        <div className="w-full h-full flex items-center gap-2 p-2 bg-gradient-to-r from-slate-900 to-slate-800 rounded-md">
          <div className="w-5 h-5 rounded-full bg-slate-700 shrink-0" />
          <div className="flex flex-col gap-1 w-full">
            <div className="w-20 h-1.5 bg-white/90 rounded-full" />
            <div className="w-14 h-1 bg-slate-400 rounded-full" />
          </div>
        </div>
      );

    case 'code':
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-950 rounded-lg text-emerald-400 font-mono">
          <div className="w-10 h-1 bg-emerald-500 rounded-full mb-1" />
          <div className="w-16 h-1 bg-slate-600 rounded-full mb-1" />
          <div className="w-12 h-1 bg-slate-700 rounded-full" />
        </div>
      );

    case 'paragraph':
    default:
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-24 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full mb-1" />
          <div className="w-20 h-1.5 bg-slate-700 dark:bg-slate-300 rounded-full mb-1" />
          <div className="w-16 h-1 bg-slate-400/60 dark:bg-slate-500 rounded-full" />
        </div>
      );
  }
}

export function PresetStyleSelector({
  value,
  options,
  onChange,
  className,
}: PresetStyleSelectorProps) {
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
      aria-label="Preset Style"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
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
              {renderMiniaturePreview(opt.value)}

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
