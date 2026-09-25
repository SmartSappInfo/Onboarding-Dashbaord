'use client';

/**
 * @fileOverview AspectRatioSelector — Segmented Aspect Ratio Control with Proportional Wireframes
 *
 * Provides a responsive visual selector for container proportions:
 * Auto, 1:1, 4:3, 16:9, 21:9, 9:16, and 3:4.
 *
 * Standards:
 * - Mobile accessibility with >= 44px touch targets (min-h-[52px]).
 * - Keyboard navigation (ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, Enter).
 * - ARIA radiogroup semantics with aria-checked state.
 * - Tactile micro-interactions (active:scale-[0.97]).
 * - Zero any typing throughout.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface AspectRatioOption {
  value: string;
  label: string;
}

export interface AspectRatioSelectorProps {
  value?: string;
  options: ReadonlyArray<AspectRatioOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature proportional geometric wireframe preview for aspect ratios.
 */
function renderRatioWireframe(ratioKey: string) {
  switch (ratioKey) {
    case '1:1':
      return <div className="w-5 h-5 rounded-xs border-2 border-current opacity-80" />;
    case '4:3':
      return <div className="w-6 h-4.5 rounded-xs border-2 border-current opacity-80" />;
    case '16:9':
      return <div className="w-7 h-4 rounded-xs border-2 border-current opacity-80" />;
    case '21:9':
      return <div className="w-8 h-3.5 rounded-xs border-2 border-current opacity-80" />;
    case '9:16':
      return <div className="w-4 h-7 rounded-xs border-2 border-current opacity-80" />;
    case '3:4':
      return <div className="w-4.5 h-6 rounded-xs border-2 border-current opacity-80" />;
    case 'auto':
    default:
      return (
        <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
          Auto
        </span>
      );
  }
}

export function AspectRatioSelector({
  value,
  options,
  onChange,
  className,
}: AspectRatioSelectorProps) {
  const currentVal = value || 'auto';

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
      aria-label="Aspect Ratio"
      className={cn("grid grid-cols-4 gap-1.5 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;
        const shortName = opt.value === 'auto' ? 'Auto' : opt.value;

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
              "group relative flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none min-h-[52px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.08] dark:bg-primary/[0.15] border-primary text-primary shadow-2xs ring-1 ring-primary/40 font-bold"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-foreground"
            )}
          >
            <div className="h-6 flex items-center justify-center mb-1">
              {renderRatioWireframe(opt.value)}
            </div>
            <span className="text-[10px] font-semibold leading-none truncate w-full block">
              {shortName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
