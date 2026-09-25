'use client';

/**
 * @fileOverview SizeSliderControl — Interactive Stepped Typography Size Slider
 *
 * Replaces generic dropdown selects with an intuitive, interactive slider for font and layout sizes.
 *
 * Features:
 * - Stepped slider with snap points corresponding to discrete Tailwind size tokens.
 * - Active size badge displaying the current human-readable label.
 * - Quick reset button (`RotateCcw`) to return to preset defaults.
 * - Tactile micro-interactions and accessible keyboard arrow navigation.
 * - Strict typing: zero `any`, zero `any[]`.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface SizeOption {
  value: string;
  label: string;
}

export interface SizeSliderControlProps {
  label?: string;
  value?: string;
  options: ReadonlyArray<SizeOption>;
  onChange: (value: string) => void;
  className?: string;
}

export function SizeSliderControl({
  label,
  value = 'default',
  options,
  onChange,
  className,
}: SizeSliderControlProps) {
  const currentIndex = React.useMemo(() => {
    const idx = options.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const currentOption = options[currentIndex] || options[0] || { value: 'default', label: 'Default' };
  const isDefault = currentIndex === 0 || value === 'default' || !value;

  const handleSliderChange = (vals: number[]) => {
    const nextIdx = vals[0] ?? 0;
    const clampedIdx = Math.max(0, Math.min(nextIdx, options.length - 1));
    const nextOpt = options[clampedIdx];
    if (nextOpt) {
      onChange(nextOpt.value);
    }
  };

  const handleReset = () => {
    const defaultOpt = options[0];
    if (defaultOpt) {
      onChange(defaultOpt.value);
    }
  };

  // Humanize short label for min and max bounds
  const minLabel = options[0]?.label?.replace(/preset size/i, '').trim() || 'Default';
  const maxLabel = options[options.length - 1]?.label?.replace(/\(.*\)/, '').trim() || 'Max';

  return (
    <div className={cn("space-y-2 py-1 select-none", className)}>
      {/* Header with Label and Current Value Pill */}
      <div className="flex items-center justify-between gap-2">
        {label && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 transition-all">
            {currentOption.label}
          </span>
          {!isDefault && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset to default preset size"
              aria-label="Reset to default preset size"
              className="p-1 rounded-md text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.95]"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Stepped Slider Track */}
      <div className="px-1 pt-1 pb-1">
        <Slider
          value={[currentIndex]}
          min={0}
          max={Math.max(1, options.length - 1)}
          step={1}
          onValueChange={handleSliderChange}
          aria-label={label || "Size slider"}
          className="cursor-pointer"
        />
      </div>

      {/* Step Bound Legend */}
      <div className="flex items-center justify-between text-[9px] font-medium text-slate-400 dark:text-slate-500 px-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
