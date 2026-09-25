'use client';

/**
 * @fileOverview ListPresetSelector — Visual Miniature Preset Style Picker for List Blocks
 *
 * Displays list preset styles as interactive thumbnail cards with exact miniature WYSIWYG
 * visual previews of each list archetype (Checklist, Bullet, Numbered, Cards, Minimal Dash, Icon Pill).
 *
 * Conforms to:
 * - Emil Kowalski tactile press micro-interactions (`active:scale-[0.98]`).
 * - Full accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard navigation with roving focus.
 * - Mobile-first touch targets (`min-h-[92px]`).
 * - High-contrast Light & Dark theme responsive styling.
 * - Strict typing: zero `any`, zero `any[]`.
 */

import React from 'react';
import { CheckCircle2, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ListPresetType } from '@/lib/page-builder/blocks/list';

export interface ListPresetOption {
  value: string;
  label: string;
}

export interface ListPresetSelectorProps {
  value?: string;
  options: ReadonlyArray<ListPresetOption>;
  onChange: (value: ListPresetType) => void;
  className?: string;
}

/**
 * Renders an exact miniature visual wireframe for each list preset style.
 */
function renderListMiniatureWireframe(presetKey: string) {
  switch (presetKey) {
    // 1. Feature Checklist
    case 'checklist':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-2 h-2 stroke-[3]" />
            </div>
            <div className="w-20 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-2 h-2 stroke-[3]" />
            </div>
            <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-2 h-2 stroke-[3]" />
            </div>
            <div className="w-18 h-1 bg-slate-400/70 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    // 2. Numbered Steps
    case 'numbered':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-black flex items-center justify-center shrink-0">
              1
            </div>
            <div className="w-20 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-black flex items-center justify-center shrink-0">
              2
            </div>
            <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-black flex items-center justify-center shrink-0">
              3
            </div>
            <div className="w-18 h-1 bg-slate-400/70 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    // 3. Item Cards
    case 'cards':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-full p-1 rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-1.5 shadow-2xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="w-16 h-1 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="w-full p-1 rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-1.5 shadow-2xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="w-14 h-1 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
        </div>
      );

    // 4. Minimal Dash
    case 'minimal-dash':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <Minus className="w-2.5 h-2.5 text-blue-500 stroke-[3] shrink-0" />
            <div className="w-20 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="w-2.5 h-2.5 text-blue-500 stroke-[3] shrink-0" />
            <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="w-2.5 h-2.5 text-blue-500 stroke-[3] shrink-0" />
            <div className="w-18 h-1 bg-slate-400/70 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );

    // 5. Icon Pill
    case 'icon-pill':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 self-start">
            <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
            <div className="w-12 h-1 bg-slate-700 dark:bg-slate-300 rounded-full" />
          </div>
          <div className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 self-start">
            <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
            <div className="w-14 h-1 bg-slate-700 dark:bg-slate-300 rounded-full" />
          </div>
        </div>
      );

    // 7. Stepped Gradient
    case 'stepped-gradient':
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900 relative">
          <div className="absolute left-[13px] top-3 bottom-3 w-[1px] bg-primary/30" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-3 h-3 rounded-full bg-linear-to-br from-primary to-accent text-white text-[7px] font-black flex items-center justify-center shrink-0 shadow-2xs">
              1
            </div>
            <div className="w-18 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-3 h-3 rounded-full bg-linear-to-br from-primary to-accent text-white text-[7px] font-black flex items-center justify-center shrink-0 shadow-2xs">
              2
            </div>
            <div className="w-14 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
        </div>
      );

    // 8. Bordered Rows
    case 'bordered-rows':
      return (
        <div className="w-full h-full flex flex-col justify-center p-1.5 bg-slate-100 dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          <div className="flex items-center justify-between py-1 px-1">
            <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
          </div>
          <div className="flex items-center justify-between py-1 px-1">
            <div className="w-14 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
          </div>
        </div>
      );

    // 6. Classic Bullet (Default)
    case 'bullet':
    default:
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <div className="w-20 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <div className="w-16 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <div className="w-18 h-1 bg-slate-400/70 dark:bg-slate-500 rounded-full" />
          </div>
        </div>
      );
  }
}

export function ListPresetSelector({
  value,
  options,
  onChange,
  className,
}: ListPresetSelectorProps) {
  const currentVal = value || options[0]?.value || 'checklist';
  const selectedIndex = options.findIndex((o) => o.value === currentVal);
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIdx = currentIndex;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(options[currentIndex].value as ListPresetType);
      return;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentIndex + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentIndex - 1 + options.length) % options.length;
    } else {
      return;
    }

    onChange(options[nextIdx].value as ListPresetType);
    const container = e.currentTarget.closest('[role="radiogroup"]');
    const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[nextIdx]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="List Preset Style"
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
            tabIndex={idx === effectiveSelectedIndex ? 0 : -1}
            aria-label={opt.label}
            onClick={() => onChange(opt.value as ListPresetType)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.98] touch-manipulation focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe Thumbnail */}
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderListMiniatureWireframe(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Preset Title */}
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
