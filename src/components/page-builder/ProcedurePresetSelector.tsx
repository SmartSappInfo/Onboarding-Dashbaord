'use client';

/**
 * @fileOverview ProcedurePresetSelector — 1-Click Miniature Wireframe Procedure Preset Picker
 *
 * Displays 5 distinct procedural archetypes with miniature WYSIWYG wireframes:
 * 1. Connected Timeline (Vertical continuous line connecting numbered badges)
 * 2. Elevated Cards (Modern floating cards with badges and soft shadows)
 * 3. Split-Media Guide (Side-by-side diagram / walkthrough media on left, steps on right)
 * 4. Minimal Clean (Editorial layout with horizontal hairline dividers and 01/02 numerals)
 * 5. Compact Badges (Horizontal grid of milestone pills for high-level journey stages)
 *
 * Standards:
 * - Minimum 44px mobile touch targets (min-h-[92px]).
 * - ARIA radiogroup and radio semantics with roving tabindex and DOM focus movement.
 * - Tactile micro-interactions (active:scale-[0.97], 150-200ms transitions).
 * - Strict typing with zero any.
 */

import React, { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcedurePresetOption {
  value: string;
  label: string;
}

export interface ProcedurePresetSelectorProps {
  value?: string;
  options: ReadonlyArray<ProcedurePresetOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature WYSIWYG preview wireframes for all 5 procedure archetypes.
 */
function renderProcedureMiniaturePreview(presetKey: string) {
  switch (presetKey) {
    case 'connected-timeline':
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-950 relative overflow-hidden">
          <div className="relative flex flex-col gap-2 pl-3">
            {/* Connecting vertical line */}
            <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-emerald-500/40" />

            {/* Step 1 */}
            <div className="relative flex items-center gap-2 z-10">
              <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center text-[7px] font-black text-white shrink-0">
                1
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="w-12 h-1 rounded-full bg-slate-200" />
                <div className="w-8 h-0.5 rounded-full bg-slate-400" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-center gap-2 z-10">
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 flex items-center justify-center text-[7px] font-black text-white shrink-0">
                2
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
                <div className="w-6 h-0.5 rounded-full bg-slate-500" />
              </div>
            </div>
          </div>
        </div>
      );

    case 'elevated-cards':
      return (
        <div className="w-full h-full flex flex-col justify-center p-1.5 bg-slate-950 gap-1.5 overflow-hidden">
          {/* Card 1 */}
          <div className="w-full h-5 rounded-md bg-slate-900 border border-slate-700/80 p-1 flex items-center gap-1.5 shadow-2xs">
            <div className="w-3 h-3 rounded-xs bg-emerald-500/80 text-[7px] font-bold text-white flex items-center justify-center shrink-0">
              1
            </div>
            <div className="w-10 h-1 rounded-full bg-slate-200" />
            <div className="w-4 h-1 rounded-full bg-emerald-500/40 ml-auto" />
          </div>

          {/* Card 2 */}
          <div className="w-full h-5 rounded-md bg-slate-900 border border-slate-700/80 p-1 flex items-center gap-1.5 shadow-2xs">
            <div className="w-3 h-3 rounded-xs bg-emerald-500/80 text-[7px] font-bold text-white flex items-center justify-center shrink-0">
              2
            </div>
            <div className="w-12 h-1 rounded-full bg-slate-200" />
          </div>
        </div>
      );

    case 'split-media':
      return (
        <div className="w-full h-full flex items-center p-1.5 bg-slate-950 gap-1.5 overflow-hidden">
          {/* Left Media Box */}
          <div className="w-1/2 h-10 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <div className="w-3 h-2 rounded-xs bg-emerald-500/50" />
          </div>

          {/* Right Steps */}
          <div className="w-1/2 flex flex-col gap-1 justify-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="w-8 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500/70 shrink-0" />
              <div className="w-6 h-1 rounded-full bg-slate-300" />
            </div>
          </div>
        </div>
      );

    case 'minimal-clean':
      return (
        <div className="w-full h-full flex flex-col justify-center p-2 bg-slate-950 divide-y divide-slate-800 gap-1 overflow-hidden">
          <div className="flex items-center gap-1.5 pb-1">
            <span className="text-[8px] font-mono font-bold text-slate-400">01.</span>
            <div className="w-12 h-1 rounded-full bg-slate-200" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[8px] font-mono font-bold text-slate-400">02.</span>
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
        </div>
      );

    case 'compact-badges':
    default:
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-950 gap-1 overflow-hidden">
          <div className="w-7 h-8 rounded-md bg-slate-900 border border-slate-700/80 p-1 flex flex-col items-center justify-between">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 text-[6px] font-bold text-white flex items-center justify-center">
              1
            </div>
            <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
          </div>
          <div className="w-7 h-8 rounded-md bg-slate-900 border border-slate-700/80 p-1 flex flex-col items-center justify-between">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 text-[6px] font-bold text-white flex items-center justify-center">
              2
            </div>
            <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
          </div>
          <div className="w-7 h-8 rounded-md bg-slate-900 border border-slate-700/80 p-1 flex flex-col items-center justify-between">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 text-[6px] font-bold text-white flex items-center justify-center">
              3
            </div>
            <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
          </div>
        </div>
      );
  }
}

export function ProcedurePresetSelector({
  value,
  options,
  onChange,
  className,
}: ProcedurePresetSelectorProps) {
  const currentVal = value || options[0]?.value || 'connected-timeline';
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectPreset = (key: string, idx?: number) => {
    onChange(key);
    if (typeof idx === 'number' && buttonRefs.current[idx]) {
      buttonRefs.current[idx]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectPreset(options[currentIndex].value, currentIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      selectPreset(options[nextIdx].value, nextIdx);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      selectPreset(options[prevIdx].value, prevIdx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Procedure Preset Archetype"
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
            onClick={() => selectPreset(opt.value, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe Thumbnail Container */}
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderProcedureMiniaturePreview(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150 z-20">
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
