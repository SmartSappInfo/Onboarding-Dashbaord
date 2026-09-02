'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Visual SVG Pattern Swatches
 */

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import type { SurveyBackgroundPattern } from './types';
import { cn } from '@/lib/utils';

export interface PatternSwatchSelectorProps {
  value: SurveyBackgroundPattern;
  patternColor: string;
  onChange: (pattern: SurveyBackgroundPattern) => void;
}

interface PatternOption {
  id: SurveyBackgroundPattern;
  label: string;
  desc: string;
}

const PATTERN_OPTIONS: PatternOption[] = [
  { id: 'none', label: 'Solid', desc: 'Minimal clean canvas' },
  { id: 'dots', label: 'Dots', desc: 'Precision matrix grid' },
  { id: 'grid', label: 'Grid', desc: 'Technical blueprint lines' },
  { id: 'circuit', label: 'Circuit', desc: 'Modern technology aura' },
  { id: 'topography', label: 'Topography', desc: 'Organic elevation waves' },
  { id: 'cubes', label: 'Cubes', desc: 'Isometric depth mesh' },
  { id: 'gradient', label: 'Aura', desc: 'Soft luminous glow' },
];

export function PatternSwatchSelector({
  value = 'none',
  patternColor = '#3B82F6',
  onChange,
}: PatternSwatchSelectorProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground">Overlay Pattern</Label>
        <span className="text-[10px] text-muted-foreground capitalize">{value || 'Solid'} Active</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PATTERN_OPTIONS.map((pattern) => {
          const isSelected = (value || 'none') === pattern.id;

          return (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onChange(pattern.id)}
              className={cn(
                'group relative p-2.5 rounded-xl border text-left transition-all h-20 flex flex-col justify-between overflow-hidden active:scale-[0.97]',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                  : 'border-border/70 hover:border-border hover:bg-muted/30 bg-card'
              )}
            >
              {/* Pattern Mini Preview Canvas */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none group-hover:opacity-25 transition-opacity"
                style={{ color: patternColor }}
              >
                {pattern.id === 'dots' && (
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="mini-dots" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mini-dots)" />
                  </svg>
                )}
                {pattern.id === 'grid' && (
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="mini-grid" width="12" height="12" patternUnits="userSpaceOnUse">
                        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.75" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mini-grid)" />
                  </svg>
                )}
                {pattern.id === 'circuit' && (
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="mini-circuit" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M 0 8 H 8 V 16 M 8 8 L 16 0" fill="none" stroke="currentColor" strokeWidth="0.75" />
                        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mini-circuit)" />
                  </svg>
                )}
                {pattern.id === 'topography' && (
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="mini-topo" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 0 10 Q 5 5, 10 10 T 20 10 M 0 15 Q 5 10, 10 15 T 20 15" fill="none" stroke="currentColor" strokeWidth="0.75" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mini-topo)" />
                  </svg>
                )}
                {pattern.id === 'cubes' && (
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="mini-cubes" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M 8 0 L 16 4 L 8 8 L 0 4 Z M 0 4 L 0 12 L 8 16 L 8 8 Z M 16 4 L 16 12 L 8 16" fill="none" stroke="currentColor" strokeWidth="0.6" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mini-cubes)" />
                  </svg>
                )}
                {pattern.id === 'gradient' && (
                  <div className="w-full h-full bg-gradient-to-br from-current to-transparent" />
                )}
              </div>

              {/* Text Label & Checkmark */}
              <div className="relative z-10 flex items-center justify-between w-full">
                <span className="font-bold text-xs text-foreground">{pattern.label}</span>
                {isSelected && (
                  <div className="w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="h-2 w-2 stroke-[3]" />
                  </div>
                )}
              </div>
              <span className="relative z-10 text-[9px] text-muted-foreground truncate">{pattern.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
