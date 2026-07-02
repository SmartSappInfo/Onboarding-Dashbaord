'use client';

import React from 'react';
import { z } from 'zod';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

const schema = z.object({
  stepNumber:    z.number().int().min(1).default(1),
  heading:       z.string().default('Step Title'),
  description:   z.string().default('Fill out the required module fields details.'),
  videoUrl:      z.string().default(''),
  imageUrl:      z.string().default(''),
  mediaPosition: z.enum(['top', 'bottom', 'left', 'right']).default('bottom'),
  accentColor:   z.string().default('#10b981'),
});
type StepSectionProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const MediaBottomThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="10" width="8" height="8" rx="4" className="text-emerald-500" />
    <rect x="18" y="10" width="40" height="4" rx="1" />
    <rect x="18" y="18" width="55" height="3" rx="1" />
    <rect x="5" y="28" width="90" height="38" rx="3" className="text-slate-800" />
  </svg>
);

const MediaRightThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="20" width="8" height="8" rx="4" className="text-emerald-500" />
    <rect x="18" y="20" width="28" height="4" rx="1" />
    <rect x="18" y="28" width="25" height="3" rx="1" />
    <rect x="52" y="15" width="43" height="45" rx="3" className="text-slate-800" />
  </svg>
);

registerBlock({
  type: 'step_section',
  label: 'Step Section',
  category: 'content',
  icon: Award,
  fields: [
    { kind: 'number', key: 'stepNumber', label: 'Step Index / Sequence' },
    { kind: 'text', key: 'heading', label: 'Step Headline' },
    { kind: 'textarea', key: 'description', label: 'Step Description' },
    { kind: 'url', key: 'videoUrl', label: 'Embed Video Link (YouTube / Vimeo)' },
    { kind: 'image', key: 'imageUrl', label: 'Step Image Source (Fallback)' },
    { kind: 'select', key: 'mediaPosition', label: 'Media Align Placement', options: [
      { value: 'top', label: 'Media on Top' },
      { value: 'bottom', label: 'Media at Bottom' },
      { value: 'left', label: 'Media on Left' },
      { value: 'right', label: 'Media on Right' },
    ] },
    { kind: 'color', key: 'accentColor', label: 'Accent Border Color' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'step-bottom', label: 'Media at Bottom', thumbnail: MediaBottomThumbnail, defaults: { mediaPosition: 'bottom' } },
    { id: 'step-right', label: 'Media on Right', thumbnail: MediaRightThumbnail, defaults: { mediaPosition: 'right' } },
  ],
  render: (props: StepSectionProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const hasMedia = props.videoUrl || props.imageUrl;
    const mediaLeftOrRight = props.mediaPosition === 'left' || props.mediaPosition === 'right';

    const textStyle = {
      color: ctx.theme.colors.text,
      fontFamily: ctx.theme.typography.headingFont,
    };

    // Render media element
    const renderMedia = () => {
      if (!hasMedia) return null;
      return (
        <div className="w-full flex-1 aspect-video rounded-2xl overflow-hidden border border-slate-850 bg-slate-950 relative shadow-2xl">
          {props.videoUrl ? (
            <iframe
              src={props.videoUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Step video visual`}
            />
          ) : props.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.imageUrl} alt={props.heading} className="w-full h-full object-cover" />
          ) : null}
        </div>
      );
    };

    const detailsMarkup = (
      <div className="flex-1 flex flex-col gap-3 text-left">
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white"
            style={{ backgroundColor: props.accentColor || '#10b981' }}
          >
            {props.stepNumber}
          </span>
          {isEdit ? (
            <input
              className="flex-1 text-xl font-bold bg-transparent border-none outline-none focus:ring-0 text-slate-100 p-0"
              style={textStyle}
              value={props.heading}
              onChange={(e) => ctx.onPropChange?.({ heading: e.target.value })}
            />
          ) : (
            <h3 className="text-xl font-bold leading-tight" style={textStyle}>
              {ctx.interpolate(props.heading)}
            </h3>
          )}
        </div>
        {isEdit ? (
          <textarea
            className="w-full text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 resize-none text-slate-400 p-0"
            value={props.description}
            rows={2}
            onChange={(e) => ctx.onPropChange?.({ description: e.target.value })}
          />
        ) : (
          <p className="text-xs font-semibold text-slate-400 leading-relaxed pl-11">
            {ctx.interpolate(props.description)}
          </p>
        )}
      </div>
    );

    return (
      <section
        className={cn(
          'w-full flex flex-col gap-6 py-6 border-l-2 pl-6',
          mediaLeftOrRight && 'md:flex-row md:items-center',
          props.mediaPosition === 'left' && 'md:flex-row-reverse'
        )}
        style={{ borderLeftColor: props.accentColor || '#10b981' }}
      >
        {props.mediaPosition === 'top' ? renderMedia() : null}
        {detailsMarkup}
        {props.mediaPosition !== 'top' ? renderMedia() : null}
      </section>
    );
  },
});
