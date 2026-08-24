'use client';

/**
 * @file src/components/page-builder/VariantBar.tsx
 * @description Studio Top Bar Switcher for A/B Test Variants in SmartSapp Page Builder.
 * Allows authors to switch viewports between "Control: Original" and competing test variants.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { Experiment, ExperimentVariant } from '@/lib/types';
import { FlaskConical, Plus, CheckCircle2, TrendingUp } from 'lucide-react';

export interface VariantBarProps {
  experiment: Experiment | null;
  activeVariantId: string | null;
  onSelectVariant: (variantId: string | null) => void;
  onCreateVariant?: () => void;
}

export const VariantBar: React.FC<VariantBarProps> = ({
  experiment,
  activeVariantId,
  onSelectVariant,
  onCreateVariant,
}) => {
  if (!experiment) return null;

  return (
    <div className="w-full bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Experiment Title & Status Badge */}
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <FlaskConical className="w-4 h-4" />
        </span>
        <span className="font-semibold text-foreground">A/B Experiment:</span>
        <span className="px-2.5 py-1 rounded-full bg-muted font-medium text-foreground border border-border/50 flex items-center gap-1.5">
          <span>{experiment.name}</span>
          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
            ({experiment.status})
          </span>
        </span>
      </div>

      {/* Variant Selector Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar" role="tablist" aria-label="A/B Experiment Variants">
        {experiment.variants.map((variant) => {
          const isSelected = activeVariantId === variant.id;

          return (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelectVariant(variant.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {variant.isControl ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              <span>{variant.name}</span>
              <span className="opacity-75 text-[10px]">({variant.weight}%)</span>
            </button>
          );
        })}

        {onCreateVariant && (
          <button
            type="button"
            onClick={onCreateVariant}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium border border-dashed border-border hover:border-amber-500/50 text-muted-foreground hover:text-amber-600 active:scale-[0.97] transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="w-3.5 h-3.5" /> New Test Variant
          </button>
        )}
      </div>
    </div>
  );
};
