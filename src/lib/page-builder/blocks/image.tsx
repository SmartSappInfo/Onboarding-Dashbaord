'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { ImageIcon, Edit } from 'lucide-react';
import { registerBlock } from '../registry';
import { cn } from '@/lib/utils';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

const schema = z.object({
  src: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default(''),
  captionColor: z.string().default('#475569'),
  width: z.enum(['small', 'medium', 'large', 'full']).default('full'),
  borderRadius: z.enum(['none', 'rounded', 'circle']).default('rounded'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
});
type ImageProps = z.infer<typeof schema>;

const WIDTH_CLASSES = {
  small: 'max-w-[120px] w-full',
  medium: 'max-w-[320px] w-full',
  large: 'max-w-[640px] w-full',
  full: 'w-full h-auto',
};

const RADIUS_CLASSES = {
  none: 'rounded-none',
  rounded: 'rounded-2xl',
  circle: 'rounded-full aspect-square object-cover',
};

registerBlock({
  type: 'image',
  label: 'Image',
  category: 'content',
  icon: ImageIcon,
  fields: [
    { kind: 'image', key: 'src', label: 'Image URL' },
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
      key: 'borderRadius',
      label: 'Border Style',
      options: [
        { value: 'none', label: 'Square (Sharp edges)' },
        { value: 'rounded', label: 'Rounded Card (16px)' },
        { value: 'circle', label: 'Circular (Avatar style)' },
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
        <div 
          onClick={() => setLibraryOpen(true)}
          className="h-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors"
        >
          <ImageIcon className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Click to select image from media library</span>
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
        </div>
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
            <figcaption 
              contentEditable={ctx.mode === 'edit'}
              suppressContentEditableWarning
              onBlur={(e) => ctx.onPropChange?.({ caption: e.currentTarget.textContent || '' })}
              className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 text-xs font-semibold text-center tracking-wide leading-relaxed outline-none"
              style={{ color: props.captionColor }}
            >
              {ctx.mode === 'edit' ? props.caption : ctx.interpolate(props.caption)}
            </figcaption>
          )}
        </figure>
      </div>
    );
  },
});
