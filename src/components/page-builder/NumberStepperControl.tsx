'use client';

/**
 * @fileOverview NumberStepperControl — Ergonomic Number Stepper Control
 *
 * Displays a tactile [-] and [+] stepper with direct numeric spinbutton input:
 * - Minimum 44px mobile touch targets (min-h-[44px], min-w-[44px]).
 * - Spinbutton ARIA semantics (role="spinbutton", aria-valuenow, aria-valuemin, aria-valuemax).
 * - Tactile micro-interactions (active:scale-[0.97], 150ms transitions).
 * - Safe numeric boundary clamping (min, max, step).
 * - Keyboard arrow navigation (ArrowUp, ArrowDown).
 * - Strict typing with zero any.
 */

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NumberStepperControlProps {
  label: string;
  value: number | string | undefined;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  onChange: (value: number) => void;
}

export function NumberStepperControl({
  label,
  value,
  min = 1,
  max,
  step = 1,
  className,
  onChange,
}: NumberStepperControlProps) {
  const numericValue = typeof value === 'number' ? value : Number(value) || min;
  const isAtMin = typeof min === 'number' && numericValue <= min;
  const isAtMax = typeof max === 'number' && numericValue >= max;

  const handleDecrement = () => {
    if (isAtMin) return;
    const nextVal = numericValue - step;
    const clamped = typeof min === 'number' ? Math.max(min, nextVal) : nextVal;
    onChange(clamped);
  };

  const handleIncrement = () => {
    if (isAtMax) return;
    const nextVal = numericValue + step;
    const clamped = typeof max === 'number' ? Math.min(max, nextVal) : nextVal;
    onChange(clamped);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min);
      return;
    }
    const parsed = Number(raw);
    if (!isNaN(parsed)) {
      let finalVal = parsed;
      if (typeof min === 'number' && finalVal < min) finalVal = min;
      if (typeof max === 'number' && finalVal > max) finalVal = max;
      onChange(finalVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-2xs overflow-hidden transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 dark:focus-within:ring-primary/20',
        className
      )}
    >
      {/* Decrement Button */}
      <button
        type="button"
        aria-label="Decrement"
        disabled={isAtMin}
        onClick={handleDecrement}
        className={cn(
          'flex items-center justify-center min-w-[44px] min-h-[44px] h-10 px-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
        )}
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Direct Spinbutton Input */}
      <input
        type="number"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={numericValue}
        aria-valuemin={min}
        aria-valuemax={max}
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="flex-1 min-h-[44px] h-10 text-center font-mono font-bold text-sm bg-transparent border-x border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      {/* Increment Button */}
      <button
        type="button"
        aria-label="Increment"
        disabled={isAtMax}
        onClick={handleIncrement}
        className={cn(
          'flex items-center justify-center min-w-[44px] min-h-[44px] h-10 px-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
        )}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
