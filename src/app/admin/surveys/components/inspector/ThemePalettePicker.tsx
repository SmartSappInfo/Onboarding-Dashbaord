'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Visual Palette Picker with Contrast Safety
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, ShieldCheck, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { SURVEY_PALETTE_PRESETS } from './theme-presets';
import { calculateContrastScore } from './contrast-utils';
import type { SurveyPalettePreset } from './types';
import { cn } from '@/lib/utils';

export interface ThemePalettePickerProps {
  backgroundColor: string;
  patternColor: string;
  onBackgroundChange: (hex: string) => void;
  onPatternChange: (hex: string) => void;
}

export function ThemePalettePicker({
  backgroundColor = '#F8FAFC',
  patternColor = '#3B82F6',
  onBackgroundChange,
  onPatternChange,
}: ThemePalettePickerProps) {
  const contrastResult = React.useMemo(() => {
    return calculateContrastScore(backgroundColor, '#0F172A');
  }, [backgroundColor]);

  const handleSelectPreset = (preset: SurveyPalettePreset) => {
    onBackgroundChange(preset.backgroundColor);
    onPatternChange(preset.patternColor);
  };

  const handleInvertColors = () => {
    const temp = backgroundColor;
    onBackgroundChange(patternColor);
    onPatternChange(temp);
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Curated Presets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Curated Studio Palettes
          </Label>
          <span className="text-[10px] text-muted-foreground">1-Click Apply</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SURVEY_PALETTE_PRESETS.map((preset) => {
            const isSelected =
              backgroundColor.toLowerCase() === preset.backgroundColor.toLowerCase() &&
              patternColor.toLowerCase() === preset.patternColor.toLowerCase();

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'group relative p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between h-20 active:scale-[0.97]',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 shadow-sm bg-primary/5'
                    : 'border-border/70 hover:border-border hover:bg-muted/30 bg-card'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold truncate text-[11px] text-foreground">{preset.name}</span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Color Swatch Visual Preview */}
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <div
                    className="w-5 h-5 rounded-md border border-black/10 shadow-xs shrink-0"
                    style={{ backgroundColor: preset.backgroundColor }}
                  />
                  <div
                    className="w-5 h-5 rounded-md border border-black/10 shadow-xs shrink-0"
                    style={{ backgroundColor: preset.patternColor }}
                  />
                  <span className="text-[9px] text-muted-foreground ml-auto uppercase font-mono font-medium">
                    {preset.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Tuning with Real-Time Contrast Safety */}
      <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">Custom Color Tuning</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleInvertColors}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" /> Swap Colors
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Base Background Color */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-semibold">Canvas Background</Label>
            <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-card shadow-xs">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => onBackgroundChange(e.target.value)}
                className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer shrink-0"
                aria-label="Pick canvas background color"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => onBackgroundChange(e.target.value)}
                className="h-8 border-none bg-transparent shadow-none font-mono text-xs font-bold uppercase p-0 focus-visible:ring-0"
                placeholder="#F8FAFC"
              />
            </div>
          </div>

          {/* Pattern / Accent Tint */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-semibold">Pattern & Accent Tint</Label>
            <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-card shadow-xs">
              <input
                type="color"
                value={patternColor}
                onChange={(e) => onPatternChange(e.target.value)}
                className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer shrink-0"
                aria-label="Pick pattern and accent tint color"
              />
              <Input
                value={patternColor}
                onChange={(e) => onPatternChange(e.target.value)}
                className="h-8 border-none bg-transparent shadow-none font-mono text-xs font-bold uppercase p-0 focus-visible:ring-0"
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>

        {/* Dynamic WCAG Contrast Score Badge */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            Readability & Contrast:
          </span>
          <Badge
            variant="outline"
            className={cn(
              'font-mono text-[10px] font-bold px-2 py-0.5 flex items-center gap-1',
              contrastResult.status === 'excellent' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
              contrastResult.status === 'good' && 'bg-blue-500/10 text-blue-600 border-blue-500/30',
              contrastResult.status === 'warning' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
              contrastResult.status === 'fail' && 'bg-red-500/10 text-red-600 border-red-500/30'
            )}
          >
            {contrastResult.isAaPassed ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {contrastResult.scoreText} {contrastResult.isAaaPassed ? 'AAA Pass' : contrastResult.isAaPassed ? 'AA Pass' : 'Low Contrast'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
