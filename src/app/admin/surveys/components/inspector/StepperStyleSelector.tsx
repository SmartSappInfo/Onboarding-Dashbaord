'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Visual Stepper Style Micro-Cards
 */

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import type { SurveyStepperVariant } from './types';
import { cn } from '@/lib/utils';

export interface StepperStyleSelectorProps {
  value: SurveyStepperVariant;
  onChange: (val: SurveyStepperVariant) => void;
}

interface StepperOption {
  id: SurveyStepperVariant;
  title: string;
  desc: string;
}

const STEPPER_OPTIONS: StepperOption[] = [
  { id: 'full', title: 'Numbered Steps', desc: 'Numbered circles with stage names' },
  { id: 'simple', title: 'Minimal Dots', desc: 'Subtle pill container with dot indicators' },
  { id: 'linear', title: 'Linear Progress', desc: 'Thin continuous line with % readout' },
  { id: 'none', title: 'Hidden (Immersive)', desc: 'Full viewport focus without progress bar' },
];

export function StepperStyleSelector({
  value = 'full',
  onChange,
}: StepperStyleSelectorProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground">Survey Stepper Style</Label>
        <span className="text-[10px] text-muted-foreground">Progress Header</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {STEPPER_OPTIONS.map((opt) => {
          const isSelected = (value || 'full') === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                'group p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 active:scale-[0.97]',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                  : 'border-border/70 hover:border-border hover:bg-muted/30 bg-card'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-xs text-foreground">{opt.title}</span>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Visual Micro-Rendered Stepper Simulation */}
              <div className="h-6 w-full rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center px-3">
                {opt.id === 'full' && (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-primary text-[8px] font-bold text-white flex items-center justify-center">
                      1
                    </div>
                    <div className="w-4 h-[1.5px] bg-primary/40" />
                    <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/30 text-[8px] font-bold text-muted-foreground flex items-center justify-center">
                      2
                    </div>
                  </div>
                )}
                {opt.id === 'simple' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border/60">
                    <div className="h-1.5 w-4 bg-primary rounded-full" />
                    <div className="h-1.5 w-1.5 bg-muted-foreground/30 rounded-full" />
                    <div className="h-1.5 w-1.5 bg-muted-foreground/30 rounded-full" />
                  </div>
                )}
                {opt.id === 'linear' && (
                  <div className="w-full flex items-center gap-1.5">
                    <div className="h-1 flex-1 bg-primary rounded-full" />
                    <div className="h-1 flex-1 bg-muted-foreground/20 rounded-full" />
                    <span className="text-[8px] font-mono text-muted-foreground font-bold">50%</span>
                  </div>
                )}
                {opt.id === 'none' && (
                  <span className="text-[10px] text-muted-foreground/60 italic">No Stepper Chrome</span>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
