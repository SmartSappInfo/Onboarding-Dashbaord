'use client';

import React from 'react';
import { z } from 'zod';
import { Quote } from 'lucide-react';
import { registerBlock } from '../registry';

const schema = z.object({
  quote: z.string().default(''),
  author: z.string().default(''),
  role: z.string().default(''),
  avatarUrl: z.string().default(''),
  videoUrl: z.string().default(''),  // NEW — video embed link
});
type TestimonialProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const StandardTestimonialThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <circle cx="50" cy="20" r="8" className="text-slate-600" />
    <rect x="15" y="36" width="70" height="4" rx="1" />
    <rect x="25" y="44" width="50" height="3" rx="1" />
  </svg>
);

const VideoTestimonialThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="10" y="10" width="80" height="38" rx="3" className="text-slate-800" />
    <polygon points="46,24 56,29 46,34" className="text-emerald-500" />
    <rect x="20" y="55" width="60" height="3" rx="1" />
  </svg>
);

registerBlock({
  type: 'testimonial',
  label: 'Testimonial',
  category: 'data',
  icon: Quote,
  fields: [
    { kind: 'textarea', key: 'quote', label: 'Quote Statement' },
    { kind: 'text', key: 'author', label: 'Author Name' },
    { kind: 'text', key: 'role', label: 'Role / Company' },
    { kind: 'image', key: 'avatarUrl', label: 'Avatar Image Source' },
    { kind: 'url', key: 'videoUrl', label: 'Optional Video Visual Link' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'testi-standard', label: 'Text Quote + Avatar', thumbnail: StandardTestimonialThumbnail, defaults: { videoUrl: '' } },
    { id: 'testi-video', label: 'Video Testimonial Card', thumbnail: VideoTestimonialThumbnail, defaults: { videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } },
  ],
  render: (props: TestimonialProps, _block, ctx) => {
    const hasVideo = props.videoUrl;

    return (
      <figure className="max-w-lg mx-auto p-6 rounded-2xl border border-slate-850 bg-slate-950/40 text-center space-y-4 shadow-xl backdrop-blur-sm">
        {hasVideo ? (
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900 mb-4">
            <iframe
              src={props.videoUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Testimonial video visual`}
            />
          </div>
        ) : (
          <Quote className="w-8 h-8 mx-auto opacity-40 text-emerald-400" />
        )}
        
        <blockquote className="text-sm italic leading-relaxed font-semibold text-slate-300">
          "{ctx.interpolate(props.quote) || 'Add a testimonial quote…'}"
        </blockquote>
        
        <figcaption className="flex items-center justify-center gap-3 pt-2 border-t border-slate-850/50">
          {props.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.avatarUrl} alt={props.author} width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-slate-800 shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
              {props.author ? props.author.slice(0, 2).toUpperCase() : 'AN'}
            </div>
          )}
          <div className="text-left leading-tight">
            <p className="text-xs font-black text-slate-200">{props.author || 'Author Name'}</p>
            {props.role ? <p className="text-[10px] text-slate-500 font-semibold">{props.role}</p> : null}
          </div>
        </figcaption>
      </figure>
    );
  },
});
