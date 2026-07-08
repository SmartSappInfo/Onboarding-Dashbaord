'use client';

import React from 'react';
import { z } from 'zod';
import { Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoEmbed from '@/components/video-embed';
import { registerBlock } from '../registry';

const itemSchema = z.object({
  id:           z.string(),
  videoUrl:     z.string().default(''),
  thumbnailUrl: z.string().default(''),
  badgeText:    z.string().default('Satisfied Parents'),
  quote:        z.string().default(''),
  author:       z.string().default(''),
  avatarUrl:    z.string().default(''),
  role:         z.string().default(''),
});

const schema = z.object({
  heading:    z.string().default('What People Are Saying'),
  subheading: z.string().default(''),
  columns:    z.enum(['1', '2', '3', '4']).default('2'),
  items:      z.array(itemSchema).default([]),
  cardStyle:  z.enum(['video-quote', 'quote-avatar', 'minimal']).default('video-quote'),
});
type TestimonialGridProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const Grid2ColThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="15" width="42" height="45" rx="3" className="text-slate-800" />
    <rect x="53" y="15" width="42" height="45" rx="3" className="text-slate-800" />
    <circle cx="26" cy="30" r="5" className="text-slate-600" />
    <circle cx="74" cy="30" r="5" className="text-slate-600" />
    <rect x="12" y="45" width="28" height="3" rx="1" />
    <rect x="60" y="45" width="28" height="3" rx="1" />
  </svg>
);

const Grid3ColThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="4" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
    <rect x="36" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
    <rect x="68" y="15" width="28" height="45" rx="2.5" className="text-slate-800" />
  </svg>
);

const SingleFeaturedThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="10" y="15" width="80" height="45" rx="4" className="text-slate-800" />
    <circle cx="25" cy="37.5" r="10" className="text-slate-600" />
    <rect x="42" y="28" width="40" height="4" rx="1" />
    <rect x="42" y="37" width="35" height="3" rx="1" />
    <rect x="42" y="44" width="20" height="3" rx="1" />
  </svg>
);

registerBlock({
  type: 'testimonial_grid',
  label: 'Testimonial Grid',
  category: 'data',
  icon: Quote,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subheading', label: 'Section Subheading' },
    { kind: 'select', key: 'columns', label: 'Columns Display', options: [
      { value: '1', label: '1 Column' },
      { value: '2', label: '2 Columns' },
      { value: '3', label: '3 Columns' },
      { value: '4', label: '4 Columns' },
    ] },
    { kind: 'select', key: 'cardStyle', label: 'Card Presentation Style', options: [
      { value: 'video-quote', label: 'Video Embed + Quote Text' },
      { value: 'quote-avatar', label: 'Avatar + Quote Card' },
      { value: 'minimal', label: 'Minimal Quote Block' },
    ] },
    { kind: 'list', key: 'items', label: 'Testimonial Items List', itemFields: [
      { kind: 'url', key: 'videoUrl', label: 'Video Link (optional)' },
      { kind: 'image', key: 'thumbnailUrl', label: 'Video Thumbnail Image (optional)' },
      { kind: 'text', key: 'badgeText', label: 'Video Badge/Label' },
      { kind: 'textarea', key: 'quote', label: 'Quote Statement' },
      { kind: 'text', key: 'author', label: 'Author Full Name' },
      { kind: 'image', key: 'avatarUrl', label: 'Avatar Image Source' },
      { kind: 'text', key: 'role', label: 'Author Job / Role' },
    ] },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'tgrid-2col', label: '2-Col Video Testimonials', thumbnail: Grid2ColThumbnail, defaults: { columns: '2', cardStyle: 'video-quote' } },
    { id: 'tgrid-3col', label: '3-Col Card Testimonials', thumbnail: Grid3ColThumbnail, defaults: { columns: '3', cardStyle: 'quote-avatar' } },
    { id: 'tgrid-featured', label: 'Featured Testimonial', thumbnail: SingleFeaturedThumbnail, defaults: { columns: '1', cardStyle: 'quote-avatar' } },
  ],
  render: (props: TestimonialGridProps, _block, ctx) => {
    const colsClass = {
      '1': 'grid-cols-1 max-w-2xl mx-auto',
      '2': 'grid-cols-1 md:grid-cols-2',
      '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    }[props.columns];

    const displayItems = props.items.length > 0 ? props.items : [
      { id: 'demo1', author: 'Joseph Aidoo', role: 'CTO, SmartSapp', quote: 'This platform makes onboarding a breeze. Highly recommended!', videoUrl: '', thumbnailUrl: '', badgeText: 'Satisfied Parents', avatarUrl: '' },
      { id: 'demo2', author: 'Ama K.', role: 'Head of Operations', quote: 'Incredible speed. Saved our team hours of manual profile entry.', videoUrl: '', thumbnailUrl: '', badgeText: 'Satisfied Parents', avatarUrl: '' },
    ];

    return (
      <section className="w-full flex flex-col gap-8 py-8 text-slate-100">
        {/* Header Block */}
        {(props.heading || props.subheading) ? (
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
            {props.heading ? (
              <h2
                className="text-2xl md:text-3xl font-black tracking-tight"
                style={{ color: ctx.theme.colors.text, fontFamily: ctx.theme.typography.headingFont }}
              >
                {ctx.interpolate(props.heading)}
              </h2>
            ) : null}
            {props.subheading ? (
              <p className="text-sm text-slate-400 leading-relaxed">
                {ctx.interpolate(props.subheading)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* testimonial cards grid */}
        <div className={cn('grid gap-6 w-full', colsClass)}>
          {displayItems.map((item, idx) => {
            const hasVideo = props.cardStyle === 'video-quote' && item.videoUrl;

            return (
              <div
                key={item.id || idx}
                className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 overflow-hidden backdrop-blur-sm shadow-xl"
              >
                {/* Optional Video Header */}
                {hasVideo ? (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                    <VideoEmbed url={item.videoUrl} thumbnailUrl={item.thumbnailUrl || undefined} className="border-0 shadow-none rounded-none w-full h-full" />
                    {item.badgeText && (
                      <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-100 bg-black/60 px-2 py-0.5 rounded">
                          {item.badgeText}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Quote block */}
                <div className="flex-1 flex flex-col gap-3">
                  <Quote className="w-5 h-5 text-emerald-400 opacity-60 flex-shrink-0" />
                  <blockquote className="text-xs font-semibold leading-relaxed italic text-slate-300">
                    "{ctx.interpolate(item.quote)}"
                  </blockquote>
                </div>

                {/* Footer User Info */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-800/50">
                  {item.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.avatarUrl}
                      alt={item.author}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                      {item.author.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left leading-tight">
                    <p className="text-[11px] font-black text-slate-200">{item.author || 'Anonymous'}</p>
                    {item.role ? <p className="text-[9px] text-slate-500 font-medium">{item.role}</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  },
});
