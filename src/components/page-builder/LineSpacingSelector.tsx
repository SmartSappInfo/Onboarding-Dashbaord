'use client';

/**
 * @fileOverview LineSpacingSelector — High-Fidelity Segmented Line Spacing (Leading) Control
 *
 * Provides an ergonomic, tactile 4-button segmented control (Tight, Normal, Relaxed, Loose)
 * with miniature visual wireframe leading bars and multiplier indicators.
 *
 * Conforms to:
 * - Emil Kowalski tactile press micro-interactions (`active:scale-[0.97]`).
 * - Full accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard arrow navigation with roving focus.
 * - Mobile-first touch ergonomics (`min-h-[44px]` touch target).
 * - Light & Dark theme responsive styling.
 * - Strict typing: zero `any`, zero `any[]`.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type LineSpacingType = 'tight' | 'normal' | 'relaxed' | 'loose';

export interface LineSpacingOption {
  value: string;
  label?: string;
}

export interface LineSpacingSelectorProps {
  value?: string;
  options?: ReadonlyArray<LineSpacingOption>;
  onChange: (value: LineSpacingType) => void;
  className?: string;
}

const DEFAULT_OPTIONS: LineSpacingOption[] = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'loose', label: 'Loose' },
];

const MULTIPLIERS: Record<string, string> = {
  tight: '1.25×',
  normal: '1.5×',
  relaxed: '1.75×',
  loose: '2.0×',
};

const GAP_CLASSES: Record<string, string> = {
  tight: 'gap-[2px]',
  normal: 'gap-[3.5px]',
  relaxed: 'gap-[5px]',
  loose: 'gap-[7px]',
};

export function LineSpacingSelector({
  value = 'normal',
  options = DEFAULT_OPTIONS,
  onChange,
  className,
}: LineSpacingSelectorProps) {
  const effectiveOptions = options.length > 0 ? options : DEFAULT_OPTIONS;
  const currentVal = (value as LineSpacingType) || 'normal';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIdx = currentIndex;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(effectiveOptions[currentIndex].value as LineSpacingType);
      return;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentIndex + 1) % effectiveOptions.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentIndex - 1 + effectiveOptions.length) % effectiveOptions.length;
    } else {
      return;
    }

    onChange(effectiveOptions[nextIdx].value as LineSpacingType);
    const container = e.currentTarget.closest('[role="radiogroup"]');
    const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[nextIdx]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Line Spacing"
      className={cn(
        "grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 w-full select-none",
        className
      )}
    >
      {effectiveOptions.map((opt, idx) => {
        const isSelected = currentVal === opt.value;
        const multiplier = MULTIPLIERS[opt.value] || '1.5×';
        const gapClass = GAP_CLASSES[opt.value] || 'gap-[3.5px]';

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value as LineSpacingType)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-xs font-bold transition-all duration-150 outline-none min-h-[44px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
              isSelected
                ? "bg-white dark:bg-slate-900 text-primary dark:text-primary shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-800/50"
            )}
          >
            {/* Visual Leading Indicator */}
            <div className={cn("w-5 flex flex-col items-center justify-center h-4 mb-1 transition-all", gapClass)}>
              <div
                className={cn(
                  "w-full h-[1.5px] rounded-full transition-colors",
                  isSelected ? "bg-primary" : "bg-muted-foreground/60"
                )}
              />
              <div
                className={cn(
                  "w-3.5 h-[1.5px] rounded-full transition-colors",
                  isSelected ? "bg-primary" : "bg-muted-foreground/60"
                )}
              />
              <div
                className={cn(
                  "w-full h-[1.5px] rounded-full transition-colors",
                  isSelected ? "bg-primary" : "bg-muted-foreground/60"
                )}
              />
            </div>

            <span className="text-[11px] font-bold leading-tight">{opt.label || opt.value}</span>
            <span className="text-[9px] font-medium opacity-65 leading-none mt-0.5">{multiplier}</span>
          </button>
        );
      })}
    </div>
  );
}
