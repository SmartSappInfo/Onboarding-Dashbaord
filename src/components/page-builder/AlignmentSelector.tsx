'use client';

/**
 * @fileOverview AlignmentSelector — High-Fidelity Segmented Alignment Control
 *
 * Provides an ergonomic, tactile 3-button icon control (Left, Center, Right, Justify)
 * conforming to standard modern design software (Figma, Canva, Webflow).
 *
 * Features:
 * - Emil Kowalski tactile press micro-interactions (`active:scale-[0.97]`).
 * - Full accessibility: `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard navigation.
 * - Light & Dark theme responsive styling.
 * - Strict typing: zero `any`, zero `any[]`.
 */

import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlignmentOption {
  value: string;
  label?: string;
}

export interface AlignmentSelectorProps {
  value?: string;
  options?: ReadonlyArray<AlignmentOption>;
  onChange: (value: string) => void;
  className?: string;
}

const DEFAULT_OPTIONS: AlignmentOption[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

function getAlignmentIcon(value: string) {
  switch (value.toLowerCase()) {
    case 'left':
    case 'text-left':
    case 'start':
      return <AlignLeft className="w-4 h-4" />;
    case 'right':
    case 'text-right':
    case 'end':
      return <AlignRight className="w-4 h-4" />;
    case 'justify':
    case 'text-justify':
      return <AlignJustify className="w-4 h-4" />;
    case 'center':
    case 'text-center':
    default:
      return <AlignCenter className="w-4 h-4" />;
  }
}

function cleanLabel(raw?: string, value?: string): string {
  if (!raw) {
    if (value === 'left') return 'Left';
    if (value === 'center') return 'Center';
    if (value === 'right') return 'Right';
    return value || '';
  }
  return raw.replace(/aligned/i, '').trim();
}

export function AlignmentSelector({
  value = 'center',
  options = DEFAULT_OPTIONS,
  onChange,
  className,
}: AlignmentSelectorProps) {
  const effectiveOptions = options.length > 0 ? options : DEFAULT_OPTIONS;
  const currentVal = value || 'center';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIdx = currentIndex;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(effectiveOptions[currentIndex].value);
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

    onChange(effectiveOptions[nextIdx].value);
    const container = e.currentTarget.closest('[role="radiogroup"]');
    const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[nextIdx]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Text Alignment"
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 w-full select-none",
        className
      )}
    >
      {effectiveOptions.map((opt, idx) => {
        const isSelected = currentVal === opt.value;
        const displayLabel = cleanLabel(opt.label, opt.value);

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
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-150 outline-none min-h-[44px] sm:min-h-[38px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-white dark:bg-slate-900 text-primary dark:text-primary shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-800/50"
            )}
          >
            {getAlignmentIcon(opt.value)}
            <span className="text-[11px] font-bold">{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
