'use client';

/**
 * @fileOverview DividerSegmentedControls — Tactile Visual Segmented Selectors for Divider Properties
 *
 * Provides specialized, responsive segmented controls:
 * 1. DividerWidthSelector: 100% Full, 75% Wide, 50% Half, 25% Narrow, 64px Accent Notch
 * 2. DividerThicknessSelector: 1px Hairline, 2px Standard, 4px Thick, 6px Heavy (with visual stroke cues)
 * 3. DividerSpacingSelector: Compact (16px), Normal (32px), Relaxed (48px), Spacious (64px)
 *
 * Standards:
 * - Minimum 44px mobile touch ergonomics (min-h-[44px] or min-h-[38px] with mobile touch area).
 * - ARIA radiogroup/radio semantics.
 * - Tactile micro-interactions (active:scale-[0.97], 150-200ms transitions).
 * - Strict typing with zero any.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type {
  DividerWidthType,
  DividerThicknessType,
  DividerSpacingType,
} from '@/lib/page-builder/blocks/divider';

export type {
  DividerWidthType,
  DividerThicknessType,
  DividerSpacingType,
};

export interface OptionItem<T extends string = string> {
  value: T;
  label: string;
}

// ---------------------------------------------------------------------------
// 1. Line Width Selector
// ---------------------------------------------------------------------------
export interface DividerWidthSelectorProps {
  value?: string;
  options: ReadonlyArray<OptionItem<DividerWidthType>>;
  onChange: (value: DividerWidthType) => void;
  className?: string;
}

export function DividerWidthSelector({
  value = 'full',
  options,
  onChange,
  className,
}: DividerWidthSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Line Width"
      className={cn('grid grid-cols-5 gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60', className)}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const shortLabels: Record<DividerWidthType, string> = {
          full: '100%',
          wide: '75%',
          medium: '50%',
          narrow: '25%',
          accent: '64px',
        };
        const shortLabel = shortLabels[opt.value] || opt.label;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-10 min-h-[40px] px-1 rounded-lg text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center cursor-pointer select-none',
              'active:scale-[0.97] touch-manipulation',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/40',
              isSelected
                ? 'bg-background text-primary shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            <span>{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Stroke Thickness Selector
// ---------------------------------------------------------------------------
export interface DividerThicknessSelectorProps {
  value?: string;
  options: ReadonlyArray<OptionItem<DividerThicknessType>>;
  onChange: (value: DividerThicknessType) => void;
  className?: string;
}

export function DividerThicknessSelector({
  value = 'hairline',
  options,
  onChange,
  className,
}: DividerThicknessSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Stroke Thickness"
      className={cn('grid grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60', className)}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const strokeHeights: Record<DividerThicknessType, string> = {
          hairline: 'h-[1px]',
          medium: 'h-[2px]',
          thick: 'h-[4px]',
          heavy: 'h-[6px]',
        };
        const strokeHeight = strokeHeights[opt.value] || 'h-[1px]';

        const shortLabels: Record<DividerThicknessType, string> = {
          hairline: '1px',
          medium: '2px',
          thick: '4px',
          heavy: '6px',
        };
        const shortLabel = shortLabels[opt.value] || opt.label;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-11 min-h-[44px] px-2 rounded-lg text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center gap-1.5 cursor-pointer select-none',
              'active:scale-[0.97] touch-manipulation',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/40',
              isSelected
                ? 'bg-background text-primary shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {/* Visual Stroke Preview Bar */}
            <div className="w-8 flex items-center justify-center h-2">
              <div
                className={cn(
                  'w-full rounded-full transition-colors',
                  strokeHeight,
                  isSelected ? 'bg-primary' : 'bg-muted-foreground/60'
                )}
              />
            </div>
            <span className="text-[11px] leading-none">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Vertical Spacing / Padding Selector
// ---------------------------------------------------------------------------
export interface DividerSpacingSelectorProps {
  value?: string;
  options: ReadonlyArray<OptionItem<DividerSpacingType>>;
  onChange: (value: DividerSpacingType) => void;
  className?: string;
}

export function DividerSpacingSelector({
  value = 'medium',
  options,
  onChange,
  className,
}: DividerSpacingSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Vertical Padding"
      className={cn('grid grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60', className)}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const shortLabels: Record<DividerSpacingType, string> = {
          compact: '16px',
          medium: '32px',
          relaxed: '48px',
          spacious: '64px',
        };
        const shortLabel = shortLabels[opt.value] || opt.label;

        const subLabels: Record<DividerSpacingType, string> = {
          compact: 'Tight',
          medium: 'Normal',
          relaxed: 'Wide',
          spacious: 'Spacious',
        };
        const subLabel = subLabels[opt.value];

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-11 min-h-[44px] px-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center cursor-pointer select-none',
              'active:scale-[0.97] touch-manipulation',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/40',
              isSelected
                ? 'bg-background text-primary shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            <span className="text-[11px] leading-tight">{shortLabel}</span>
            <span className="text-[9px] font-medium opacity-70 leading-tight">{subLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
