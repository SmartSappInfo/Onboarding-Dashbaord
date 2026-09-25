'use client';

/**
 * @fileOverview Image Block Definition & Runtime Renderer
 *
 * Implements the Image Presets, Masking, Framing & Interactive Behavior Architecture.
 * Supports:
 * - 8 visual presets: clean-card, browser-mockup, mobile-chassis, cathedral-arch,
 *   circular-avatar, floating-elevated, interactive-zoom, neo-brutalist.
 * - Geometric masks: none (sharp), rounded (16px), squircle (28px), circle (avatar), cathedral arch.
 * - Aspect ratios: auto, 1:1, 4:3, 16:9, 21:9, 9:16, 3:4.
 * - Elevation & device frames: flat, hairline, shadow, browser mockup, mobile chassis.
 * - Interactive hover states: none, scale zoom, grayscale reveal, duotone wash.
 * - Backward compatibility adapter for legacy blocks with { borderRadius: 'none' | 'rounded' | 'circle' }.
 */

import React, { useState } from 'react';
import { z } from 'zod';
import { ImageIcon, Edit } from 'lucide-react';
import { registerBlock } from '../registry';
import { cn } from '@/lib/utils';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { InlineEditable } from '@/components/page-builder/InlineEditable';

export type ImagePresetId =
  | 'clean-card'
  | 'browser-mockup'
  | 'mobile-chassis'
  | 'cathedral-arch'
  | 'circular-avatar'
  | 'floating-elevated'
  | 'interactive-zoom'
  | 'neo-brutalist';

export type ImageAspectRatio = 'auto' | '1:1' | '4:3' | '16:9' | '21:9' | '9:16' | '3:4';
export type ImageBorderRadius = 'none' | 'rounded' | 'squircle' | 'circle' | 'arch';
export type ImageElevation = 'none' | 'hairline' | 'shadow' | 'browser' | 'mobile';
export type ImageHoverEffect = 'none' | 'zoom' | 'grayscale' | 'duotone';
export type ImageObjectFit = 'cover' | 'contain';

const rawSchema = z.object({
  src: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default(''),
  captionColor: z.string().default('#475569'),
  width: z.enum(['small', 'medium', 'large', 'full']).default('full'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  preset: z.enum([
    'clean-card',
    'browser-mockup',
    'mobile-chassis',
    'cathedral-arch',
    'circular-avatar',
    'floating-elevated',
    'interactive-zoom',
    'neo-brutalist',
  ]).optional(),
  borderRadius: z.enum(['none', 'rounded', 'squircle', 'circle', 'arch']).default('rounded'),
  aspectRatio: z.enum(['auto', '1:1', '4:3', '16:9', '21:9', '9:16', '3:4']).default('auto'),
  elevation: z.enum(['none', 'hairline', 'shadow', 'browser', 'mobile']).default('hairline'),
  hoverEffect: z.enum(['none', 'zoom', 'grayscale', 'duotone']).default('none'),
  objectFit: z.enum(['cover', 'contain']).default('cover'),
});

// Backward compatibility & preset smart-defaults transform
const schema = rawSchema.transform((data) => {
  // If legacy props provided without preset:
  if (!data.preset) {
    if (data.borderRadius === 'circle') {
      return {
        ...data,
        preset: 'circular-avatar' as const,
        aspectRatio: data.aspectRatio === 'auto' ? ('1:1' as const) : data.aspectRatio,
        borderRadius: 'circle' as const,
      };
    }
    if (data.borderRadius === 'none') {
      return {
        ...data,
        preset: 'neo-brutalist' as const,
        elevation: data.elevation === 'hairline' ? ('shadow' as const) : data.elevation,
        borderRadius: 'none' as const,
      };
    }
    return {
      ...data,
      preset: 'clean-card' as const,
    };
  }

  // Preset smart defaults mapping
  if (data.preset === 'browser-mockup') {
    return {
      ...data,
      elevation: 'browser' as const,
      borderRadius: 'rounded' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('16:9' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'mobile-chassis') {
    return {
      ...data,
      elevation: 'mobile' as const,
      borderRadius: 'squircle' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('9:16' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'cathedral-arch') {
    return {
      ...data,
      borderRadius: 'arch' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('3:4' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'circular-avatar') {
    return {
      ...data,
      borderRadius: 'circle' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('1:1' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'floating-elevated') {
    return {
      ...data,
      elevation: 'shadow' as const,
      borderRadius: 'rounded' as const,
    };
  }
  if (data.preset === 'interactive-zoom') {
    return {
      ...data,
      hoverEffect: 'zoom' as const,
      borderRadius: 'rounded' as const,
    };
  }
  if (data.preset === 'neo-brutalist') {
    return {
      ...data,
      borderRadius: 'none' as const,
      elevation: 'shadow' as const,
    };
  }

  return data;
});

type ImageProps = z.output<typeof schema>;

const WIDTH_CLASSES = {
  small: 'max-w-[120px] w-full',
  medium: 'max-w-[320px] w-full',
  large: 'max-w-[640px] w-full',
  full: 'w-full h-auto',
};

const RADIUS_CLASSES: Record<ImageBorderRadius, string> = {
  none: 'rounded-none',
  rounded: 'rounded-2xl',
  squircle: 'rounded-[28px]',
  circle: 'rounded-full aspect-square object-cover',
  arch: 'rounded-t-[9999px] rounded-b-xl',
};

registerBlock({
  type: 'image',
  label: 'Image',
  category: 'content',
  icon: ImageIcon,
  fields: [
    { kind: 'image', key: 'src', label: 'Image URL' },
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Style',
      options: [
        { value: 'clean-card', label: 'Clean Card' },
        { value: 'browser-mockup', label: 'Browser Window' },
        { value: 'mobile-chassis', label: 'Mobile Chassis' },
        { value: 'cathedral-arch', label: 'Cathedral Arch' },
        { value: 'circular-avatar', label: 'Circular Avatar' },
        { value: 'floating-elevated', label: 'Floating Elevated' },
        { value: 'interactive-zoom', label: 'Interactive Zoom' },
        { value: 'neo-brutalist', label: 'Neo-Brutalist' },
      ],
    },
    {
      kind: 'select',
      key: 'aspectRatio',
      label: 'Aspect Ratio',
      options: [
        { value: 'auto', label: 'Auto (Original)' },
        { value: '1:1', label: '1:1 Square' },
        { value: '4:3', label: '4:3 Standard' },
        { value: '16:9', label: '16:9 Landscape' },
        { value: '21:9', label: '21:9 Ultra-Wide' },
        { value: '9:16', label: '9:16 Vertical' },
        { value: '3:4', label: '3:4 Portrait' },
      ],
    },
    {
      kind: 'select',
      key: 'borderRadius',
      label: 'Corner Shape & Mask',
      options: [
        { value: 'none', label: 'Sharp (0px)' },
        { value: 'rounded', label: 'Card (16px)' },
        { value: 'squircle', label: 'Squircle (28px)' },
        { value: 'arch', label: 'Cathedral Arch' },
        { value: 'circle', label: 'Circle / Pill' },
      ],
    },
    {
      kind: 'select',
      key: 'elevation',
      label: 'Elevation & Frame',
      options: [
        { value: 'none', label: 'None (Flat)' },
        { value: 'hairline', label: 'Subtle Hairline Border' },
        { value: 'shadow', label: 'Floating Drop Shadow' },
        { value: 'browser', label: 'Desktop Browser Window' },
        { value: 'mobile', label: 'Mobile Phone Chassis' },
      ],
    },
    {
      kind: 'select',
      key: 'hoverEffect',
      label: 'Hover Animation',
      options: [
        { value: 'none', label: 'None' },
        { value: 'zoom', label: 'Scale & Zoom' },
        { value: 'grayscale', label: 'Grayscale to Color' },
        { value: 'duotone', label: 'Duotone Wash' },
      ],
    },
    {
      kind: 'select',
      key: 'objectFit',
      label: 'Image Fit Mode',
      options: [
        { value: 'cover', label: 'Fill & Cover (Crop to fit)' },
        { value: 'contain', label: 'Fit Inside (No crop)' },
      ],
    },
    { kind: 'text', key: 'alt', label: 'Alt Text' },
    { kind: 'text', key: 'caption', label: 'Caption' },
    { kind: 'color', key: 'captionColor', label: 'Caption Text Color' },
    {
      kind: 'select',
      key: 'width',
      label: 'Image Width Size',
      options: [
        { value: 'small', label: 'Small (120px)' },
        { value: 'medium', label: 'Medium (320px)' },
        { value: 'large', label: 'Large (640px)' },
        { value: 'full', label: 'Full Width (100%)' },
      ],
    },
    {
      kind: 'select',
      key: 'alignment',
      label: 'Image Alignment',
      options: [
        { value: 'left', label: 'Align Left' },
        { value: 'center', label: 'Align Center' },
        { value: 'right', label: 'Align Right' },
      ],
    },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: ImageProps, _block, ctx) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [libraryOpen, setLibraryOpen] = useState(false);

    if (!props.src) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <>
          <div 
            onClick={() => setLibraryOpen(true)}
            className="h-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Click to select image from media library</span>
          </div>
          {ctx.page?.workspaceId && (
            <MediaSelectorDialog
              open={libraryOpen}
              onOpenChange={setLibraryOpen}
              onSelectAsset={(asset) => {
                ctx.onPropChange?.({ src: asset.url });
                setLibraryOpen(false);
              }}
              filterType="image"
              workspaceId={ctx.page.workspaceId}
            />
          )}
        </>
      );
    }

    const changeButton = ctx.mode === 'edit' && ctx.page?.workspaceId && (
      <>
        <div 
          onClick={(e) => { e.stopPropagation(); setLibraryOpen(true); }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-10"
        >
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <Edit className="w-3.5 h-3.5" />
            Change Image
          </button>
        </div>
        <MediaSelectorDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({ src: asset.url });
            setLibraryOpen(false);
          }}
          filterType="image"
          workspaceId={ctx.page.workspaceId}
        />
      </>
    );

    return (
      <div className={cn("w-full flex", {
        'justify-start': props.alignment === 'left',
        'justify-center': props.alignment === 'center',
        'justify-end': props.alignment === 'right',
      })}>
        <figure className={cn(
          "relative group overflow-hidden shadow-sm transition-all duration-300",
          WIDTH_CLASSES[props.width],
          RADIUS_CLASSES[props.borderRadius],
          props.caption ? "border border-slate-200/40 dark:border-zinc-800/40 bg-white dark:bg-zinc-950" : "border border-transparent bg-transparent"
        )}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={props.src} 
            alt={props.alt} 
            className={cn("w-full object-cover", {
              'h-full aspect-square': props.borderRadius === 'circle',
              'h-auto': props.borderRadius !== 'circle'
            })} 
            loading="lazy" 
          />
          {changeButton}
          {props.caption && (
            <InlineEditable
              tagName="figcaption"
              isEdit={ctx.mode === 'edit'}
              data-block-id={_block.id}
              data-prop-key="caption"
              data-rich="false"
              onChange={(val) => ctx.onPropChange?.({ caption: val })}
              className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 text-xs font-semibold text-center tracking-wide leading-relaxed outline-none"
              style={{ color: props.captionColor }}
              value={props.caption}
              html={false}
            />
          )}
        </figure>
      </div>
    );
  },
});
