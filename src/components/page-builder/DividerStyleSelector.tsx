'use client';

/**
 * @fileOverview DividerStyleSelector — WYSIWYG Visual Divider Style Picker
 *
 * Displays 8 distinct divider line styles with live miniature wireframe previews:
 * 1. Solid Continuous (Clean crisp line)
 * 2. Modern Dashed (Contemporary segmented dashes)
 * 3. Refined Dotted (Stipple dots)
 * 4. Vignette Gradient (Edges fade to transparent)
 * 5. Double Hairline (Editorial luxury double rule)
 * 6. Neon Glow Aura (Illuminated glow beam)
 * 7. Center Text Badge (Centered text chip e.g. "OR")
 * 8. Diamond Notch Glyph (Centered ornament glyph e.g. "◆")
 *
 * Standards:
 * - Minimum 44px mobile touch targets (min-h-[58px]).
 * - ARIA radiogroup and radio semantics with roving tabindex and DOM focus movement.
 * - Tactile micro-interactions (active:scale-[0.97], 150-200ms transitions).
 * - Zero raw code/HTML tags in UI.
 * - Strict typing with zero any.
 */

import React, { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DividerStyleType } from '@/lib/page-builder/blocks/divider';

export interface DividerStyleOption {
  value: string;
  label: string;
}

export interface DividerStyleSelectorProps {
  value?: string;
  options: ReadonlyArray<DividerStyleOption>;
  onChange: (value: DividerStyleType) => void;
  className?: string;
}

/**
 * Renders miniature visual wireframe for each divider style archetype.
 */
function renderDividerMiniaturePreview(styleKey: string) {
  switch (styleKey) {
    case 'solid':
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full h-[2px] bg-foreground/75 rounded-full" />
        </div>
      );

    case 'dashed':
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full border-t-2 border-dashed border-foreground/75" />
        </div>
      );

    case 'dotted':
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full border-t-2 border-dotted border-foreground/75" />
        </div>
      );

    case 'gradient':
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-foreground/80 to-transparent rounded-full" />
        </div>
      );

    case 'double':
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full flex flex-col gap-0.5">
            <div className="w-full h-[1px] bg-foreground/70 rounded-full" />
            <div className="w-full h-[1px] bg-foreground/70 rounded-full" />
          </div>
        </div>
      );

    case 'glow':
      return (
        <div className="w-full h-full flex items-center justify-center px-3 relative">
          <div className="absolute inset-x-3 h-2 bg-blue-500/35 blur-xs rounded-full pointer-events-none" />
          <div className="w-full h-[2px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] relative z-10" />
        </div>
      );

    case 'badge':
      return (
        <div className="w-full h-full flex items-center justify-center px-2 relative">
          <div className="absolute inset-x-2 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative px-1.5 py-0.5 bg-card text-[8px] font-bold text-muted-foreground uppercase tracking-widest rounded border border-border/80 shadow-2xs">
            OR
          </div>
        </div>
      );

    case 'notch':
      return (
        <div className="w-full h-full flex items-center justify-center px-2 relative">
          <div className="absolute inset-x-2 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative px-1 bg-card text-primary text-[9px] leading-none">
            ◆
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full flex items-center justify-center px-3">
          <div className="w-full h-[2px] bg-foreground/70 rounded-full" />
        </div>
      );
  }
}

export function DividerStyleSelector({
  value = 'solid',
  options,
  onChange,
  className,
}: DividerStyleSelectorProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = options.length - 1;
    }

    if (nextIndex !== index) {
      const nextOption = options[nextIndex];
      if (nextOption) {
        onChange(nextOption.value as DividerStyleType);
        buttonRefs.current[nextIndex]?.focus();
      }
    }
  };

  const selectedIndex = options.findIndex((o) => o.value === value);
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  return (
    <div
      role="radiogroup"
      aria-label="Divider Style"
      className={cn('grid grid-cols-2 gap-2.5', className)}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            tabIndex={index === effectiveSelectedIndex ? 0 : -1}
            onClick={() => onChange(option.value as DividerStyleType)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'group relative flex flex-col items-center justify-between p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer min-h-[64px]',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'active:scale-[0.97] touch-manipulation',
              isSelected
                ? 'bg-primary/5 border-primary shadow-xs'
                : 'bg-card hover:bg-muted/50 border-border hover:border-slate-300 dark:hover:border-zinc-700'
            )}
          >
            {/* Top Miniature Wireframe Canvas */}
            <div className="w-full h-8 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-center overflow-hidden transition-colors group-hover:bg-slate-200/70 dark:group-hover:bg-zinc-850">
              {renderDividerMiniaturePreview(option.value)}
            </div>

            {/* Bottom Label and Checkmark */}
            <div className="w-full flex items-center justify-between gap-1.5 mt-2 px-0.5">
              <span
                className={cn(
                  'text-[11px] font-semibold tracking-tight truncate',
                  isSelected
                    ? 'text-primary font-bold'
                    : 'text-foreground/90 group-hover:text-foreground'
                )}
              >
                {option.label}
              </span>

              {isSelected && (
                <div
                  data-testid="selected-check"
                  className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-2xs"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground stroke-[3]" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default DividerStyleSelector;
