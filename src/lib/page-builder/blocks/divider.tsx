import React from 'react';
import { z } from 'zod';
import { Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

export type DividerStyleType =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'gradient'
  | 'double'
  | 'glow'
  | 'badge'
  | 'notch';

export type DividerWidthType = 'full' | 'wide' | 'medium' | 'narrow' | 'accent';
export type DividerThicknessType = 'hairline' | 'medium' | 'thick' | 'heavy';
export type DividerSpacingType = 'compact' | 'medium' | 'relaxed' | 'spacious';
export type DividerAlignmentType = 'left' | 'center' | 'right';

const schema = z.object({
  style: z
    .enum(['solid', 'dashed', 'dotted', 'gradient', 'double', 'glow', 'badge', 'notch'])
    .default('solid'),
  color: z.string().default('#e2e8f0'),
  width: z.enum(['full', 'wide', 'medium', 'narrow', 'accent']).default('full'),
  thickness: z.enum(['hairline', 'medium', 'thick', 'heavy']).default('hairline'),
  spacing: z.enum(['compact', 'medium', 'relaxed', 'spacious']).default('medium'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  label: z.string().optional().default(''),
});

export type DividerProps = z.infer<typeof schema>;

export const DIVIDER_STYLE_OPTIONS = [
  { value: 'solid', label: 'Solid Continuous' },
  { value: 'dashed', label: 'Modern Dashed' },
  { value: 'dotted', label: 'Refined Dotted' },
  { value: 'gradient', label: 'Vignette Gradient' },
  { value: 'double', label: 'Double Hairline' },
  { value: 'glow', label: 'Neon Glow Aura' },
  { value: 'badge', label: 'Center Text Badge' },
  { value: 'notch', label: 'Diamond Notch Glyph' },
] as const;

export const DIVIDER_WIDTH_OPTIONS = [
  { value: 'full', label: '100% Full Width' },
  { value: 'wide', label: '75% Wide' },
  { value: 'medium', label: '50% Half' },
  { value: 'narrow', label: '25% Narrow' },
  { value: 'accent', label: '64px Accent Notch' },
] as const;

export const DIVIDER_THICKNESS_OPTIONS = [
  { value: 'hairline', label: '1px Hairline' },
  { value: 'medium', label: '2px Standard' },
  { value: 'thick', label: '4px Thick' },
  { value: 'heavy', label: '6px Heavy' },
] as const;

export const DIVIDER_SPACING_OPTIONS = [
  { value: 'compact', label: 'Compact (16px)' },
  { value: 'medium', label: 'Normal (32px)' },
  { value: 'relaxed', label: 'Relaxed (48px)' },
  { value: 'spacious', label: 'Spacious (64px)' },
] as const;

registerBlock({
  type: 'divider',
  label: 'Divider',
  category: 'content',
  icon: Minus,
  fields: [
    {
      kind: 'select',
      key: 'style',
      label: 'Divider Style',
      options: DIVIDER_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: 'select',
      key: 'width',
      label: 'Line Width',
      options: DIVIDER_WIDTH_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: 'select',
      key: 'alignment',
      label: 'Alignment',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
    },
    {
      kind: 'select',
      key: 'thickness',
      label: 'Stroke Thickness',
      options: DIVIDER_THICKNESS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: 'select',
      key: 'spacing',
      label: 'Vertical Padding',
      options: DIVIDER_SPACING_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: 'text',
      key: 'label',
      label: 'Badge / Notch Text',
      placeholder: 'e.g. OR, CHAPTER, ✦',
    },
    {
      kind: 'color',
      key: 'color',
      label: 'Line & Accent Color',
    },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: DividerProps) => {
    const isCustomColor = Boolean(props.color && props.color !== '#e2e8f0');
    const customBorder = isCustomColor ? { borderColor: props.color } : undefined;
    const customBg = isCustomColor ? { backgroundColor: props.color } : undefined;
    const customGlow = isCustomColor ? { backgroundColor: props.color, boxShadow: `0 0 16px ${props.color}` } : undefined;

    // Outer vertical padding spacing
    const spacingClass = {
      compact: 'py-2 sm:py-3',
      medium: 'py-4 sm:py-6',
      relaxed: 'py-8 sm:py-10',
      spacious: 'py-12 sm:py-16',
    }[props.spacing || 'medium'];

    // Width class
    const widthClass = {
      full: 'w-full',
      wide: 'w-3/4 max-w-[75%]',
      medium: 'w-1/2 max-w-[50%]',
      narrow: 'w-1/4 max-w-[25%]',
      accent: 'w-16 max-w-[64px]',
    }[props.width || 'full'];

    // Alignment flex container
    const alignmentClass = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
    }[props.alignment || 'center'];

    // Thickness stroke mapping
    const thicknessBorderClass = {
      hairline: 'border-t',
      medium: 'border-t-2',
      thick: 'border-t-4',
      heavy: 'border-t-[6px]',
    }[props.thickness || 'hairline'];

    const thicknessHeightClass = {
      hairline: 'h-[1px]',
      medium: 'h-[2px]',
      thick: 'h-[4px]',
      heavy: 'h-[6px]',
    }[props.thickness || 'hairline'];

    const fallbackBorderClass = isCustomColor
      ? ''
      : 'border-slate-200/90 dark:border-zinc-800';

    const fallbackBgClass = isCustomColor
      ? ''
      : 'bg-slate-200/90 dark:bg-zinc-800';

    return (
      <div
        data-testid="divider-container"
        className={cn('w-full flex items-center select-none', spacingClass, alignmentClass)}
      >
        <div data-testid="divider-inner" className={cn('relative flex items-center', widthClass)}>
          {/* 1. Double Hairline Style */}
          {props.style === 'double' && (
            <div data-testid="divider-double" className="flex flex-col gap-1 w-full">
              <div
                className={cn('w-full rounded-full', fallbackBgClass, thicknessHeightClass)}
                style={customBg}
              />
              <div
                className={cn('w-full rounded-full', fallbackBgClass, thicknessHeightClass)}
                style={customBg}
              />
            </div>
          )}

          {/* 2. Neon Glow Aura Style */}
          {props.style === 'glow' && (
            <div data-testid="divider-glow" className="relative w-full flex items-center justify-center">
              <div
                className="absolute inset-0 bg-blue-500/35 blur-md rounded-full pointer-events-none -z-0 motion-reduce:hidden will-change-transform"
                style={isCustomColor ? { backgroundColor: props.color, opacity: 0.35 } : undefined}
              />
              <div
                className={cn(
                  'w-full rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]',
                  isCustomColor ? '' : 'bg-blue-500',
                  thicknessHeightClass
                )}
                style={customGlow}
              />
            </div>
          )}

          {/* 3. Vignette Gradient Style */}
          {props.style === 'gradient' && (
            <div
              data-testid="divider-gradient"
              className={cn(
                'w-full rounded-full bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-600 to-transparent',
                thicknessHeightClass
              )}
              style={
                isCustomColor
                  ? {
                      background: `linear-gradient(90deg, transparent 0%, ${props.color} 50%, transparent 100%)`,
                    }
                  : undefined
              }
            />
          )}

          {/* 4. Center Badge Text Style */}
          {props.style === 'badge' && (
            <div data-testid="divider-badge" className="relative w-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div
                  className={cn('w-full border-t', fallbackBorderClass, thicknessBorderClass)}
                  style={customBorder}
                />
              </div>
              <div
                className="relative px-3 py-1 bg-background text-[11px] font-bold text-muted-foreground uppercase tracking-widest rounded-full border border-border/80 shadow-2xs select-none shrink-0"
                style={isCustomColor ? { borderColor: props.color } : undefined}
              >
                {props.label?.trim() || 'OR'}
              </div>
            </div>
          )}

          {/* 5. Center Diamond Notch Style */}
          {props.style === 'notch' && (
            <div data-testid="divider-notch" className="relative w-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div
                  className={cn('w-full border-t', fallbackBorderClass, thicknessBorderClass)}
                  style={customBorder}
                />
              </div>
              <div
                className="relative px-2.5 bg-background text-primary flex items-center justify-center select-none shrink-0"
                style={isCustomColor ? { color: props.color } : undefined}
              >
                <span className="text-xs font-bold leading-none">{props.label?.trim() || '◆'}</span>
              </div>
            </div>
          )}

          {/* 6. Standard Rules (Solid, Dashed, Dotted) */}
          {(props.style === 'solid' || props.style === 'dashed' || props.style === 'dotted') && (
            <hr
              data-testid={`divider-${props.style}`}
              className={cn(
                'w-full border-0',
                thicknessBorderClass,
                props.style === 'dashed' && 'border-dashed',
                props.style === 'dotted' && 'border-dotted',
                fallbackBorderClass
              )}
              style={customBorder}
            />
          )}
        </div>
      </div>
    );
  },
});
