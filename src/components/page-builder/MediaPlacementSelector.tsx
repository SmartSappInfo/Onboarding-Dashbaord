'use client';

/**
 * @fileOverview MediaPlacementSelector — Visual Miniature Wireframe Media Alignment Picker
 *
 * Displays 4 distinct spatial media alignment positions with miniature WYSIWYG wireframes:
 * 1. Media on Top (Media stacked above headline and description)
 * 2. Media at Bottom (Media stacked below headline and description)
 * 3. Media on Left (Media positioned on the left 50/50 split, text on the right)
 * 4. Media on Right (Media positioned on the right 50/50 split, text on the left)
 *
 * Standards:
 * - Minimum 44px mobile touch targets (min-h-[92px]).
 * - WAI-ARIA radiogroup and radio semantics with roving tabindex and DOM focus movement via buttonRefs.
 * - Tactile micro-interactions (active:scale-[0.97], 150-200ms transitions).
 * - Strict typing with zero any.
 */

import React, { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaPlacementOption {
  value: string;
  label: string;
}

export interface MediaPlacementSelectorProps {
  value?: string;
  options: ReadonlyArray<MediaPlacementOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature WYSIWYG preview wireframes showing spatial orientation of media and text.
 */
function renderMediaPlacementWireframe(positionKey: string) {
  switch (positionKey) {
    case 'top':
      return (
        <div className="w-full h-full flex flex-col justify-between p-2 bg-slate-100 dark:bg-slate-900 gap-1.5">
          {/* Top Media Box */}
          <div className="w-full h-6 rounded bg-emerald-500/25 dark:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
            <div className="w-3 h-2 rounded-xs bg-emerald-500/50" />
          </div>
          {/* Bottom Text Lines */}
          <div className="w-full flex flex-col gap-1">
            <div className="w-3/4 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            <div className="w-1/2 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
        </div>
      );

    case 'bottom':
      return (
        <div className="w-full h-full flex flex-col justify-between p-2 bg-slate-100 dark:bg-slate-900 gap-1.5">
          {/* Top Text Lines */}
          <div className="w-full flex flex-col gap-1">
            <div className="w-3/4 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            <div className="w-1/2 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
          {/* Bottom Media Box */}
          <div className="w-full h-6 rounded bg-emerald-500/25 dark:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
            <div className="w-3 h-2 rounded-xs bg-emerald-500/50" />
          </div>
        </div>
      );

    case 'left':
      return (
        <div className="w-full h-full flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-900 gap-1.5">
          {/* Left Media Box */}
          <div className="w-1/2 h-10 rounded bg-emerald-500/25 dark:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
            <div className="w-3 h-2 rounded-xs bg-emerald-500/50" />
          </div>
          {/* Right Text Lines */}
          <div className="w-1/2 flex flex-col gap-1">
            <div className="w-full h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            <div className="w-3/4 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="w-1/2 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80" />
          </div>
        </div>
      );

    case 'right':
      return (
        <div className="w-full h-full flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-900 gap-1.5">
          {/* Left Text Lines */}
          <div className="w-1/2 flex flex-col gap-1">
            <div className="w-full h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            <div className="w-3/4 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="w-1/2 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80" />
          </div>
          {/* Right Media Box */}
          <div className="w-1/2 h-10 rounded bg-emerald-500/25 dark:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
            <div className="w-3 h-2 rounded-xs bg-emerald-500/50" />
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-12 h-8 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      );
  }
}

export function MediaPlacementSelector({
  value,
  options,
  onChange,
  className,
}: MediaPlacementSelectorProps) {
  const currentVal = value || options[0]?.value;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectOption = (key: string, idx?: number) => {
    onChange(key);
    if (typeof idx === 'number' && buttonRefs.current[idx]) {
      buttonRefs.current[idx]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectOption(options[currentIndex].value, currentIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      selectOption(options[nextIdx].value, nextIdx);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      selectOption(options[prevIdx].value, prevIdx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Media Align Placement"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            ref={(el) => { buttonRefs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => selectOption(opt.value, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe View */}
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderMediaPlacementWireframe(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150 z-20">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Label */}
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
