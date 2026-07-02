'use client';

import React from 'react';
import { z } from 'zod';
import { Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';

// bundle-dynamic-imports: WebGL light ray canvas is browser-only
const LightRays = dynamic(() => import('@/components/LightRays'), { ssr: false });

const schema = z.object({
  videoUrl:            z.string().default(''),
  headline:            z.string().default('Welcome to SmartSapp'),
  subheadline:         z.string().default('The next generation onboarding platform.'),
  overlayColor:        z.string().default('rgba(10,20,39,0.7)'),
  lightRaysEnabled:    z.boolean().default(true),
  lightRaysColor:      z.string().default('#3B5FFF'),
  showScrollIndicator: z.boolean().default(true),
  scrollTarget:        z.string().default('#next'),
  headlineGradient:    z.boolean().default(true),
  gradientFrom:        z.string().default('#3B5FFF'),
  gradientTo:          z.string().default('#7C3AED'),
});
type VideoHeroProps = z.infer<typeof schema>;

// Module-level thumbnails for variants (rerender-no-inline-components)
const MainWelcomeThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="0" y="0" width="100" height="75" rx="4" className="text-slate-850" />
    <circle cx="50" cy="37.5" r="30" className="text-emerald-500/10" />
    <polygon points="46,32 58,37.5 46,43" className="text-emerald-400" />
    <rect x="15" y="55" width="70" height="5" rx="1.5" className="text-slate-400" />
  </svg>
);

const MinimalWelcomeThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="10" y="25" width="80" height="6" rx="1.5" className="text-slate-300" />
    <rect x="25" y="38" width="50" height="4" rx="1" />
  </svg>
);

registerBlock({
  type: 'video_hero',
  label: 'Video Hero',
  category: 'content',
  icon: Play,
  fields: [
    { kind: 'url', key: 'videoUrl', label: 'Video Source URL (.mp4 / Youtube)' },
    { kind: 'text', key: 'headline', label: 'Headline' },
    { kind: 'textarea', key: 'subheadline', label: 'Sub-headline' },
    { kind: 'color', key: 'overlayColor', label: 'Overlay Color' },
    { kind: 'boolean', key: 'lightRaysEnabled', label: 'Enable Light Rays' },
    { kind: 'color', key: 'lightRaysColor', label: 'Light Rays Color' },
    { kind: 'boolean', key: 'showScrollIndicator', label: 'Show Scroll Indicator' },
    { kind: 'text', key: 'scrollTarget', label: 'Scroll Target Anchor ID' },
    { kind: 'boolean', key: 'headlineGradient', label: 'Use text gradient' },
    { kind: 'color', key: 'gradientFrom', label: 'Gradient color from' },
    { kind: 'color', key: 'gradientTo', label: 'Gradient color to' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'vhero-welcome', label: 'SmartSapp Welcome', thumbnail: MainWelcomeThumbnail, defaults: { lightRaysEnabled: true, headlineGradient: true, showScrollIndicator: true } },
    { id: 'vhero-minimal', label: 'Minimal Video Hero', thumbnail: MinimalWelcomeThumbnail, defaults: { lightRaysEnabled: false, headlineGradient: false, showScrollIndicator: false } },
  ],
  render: (props: VideoHeroProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';

    const textStyle = {
      color: '#ffffff',
      fontFamily: ctx.theme.typography.headingFont,
    };

    const headlineMarkup = props.headlineGradient ? (
      <span
        style={{
          background: `linear-gradient(135deg, ${props.gradientFrom}, ${props.gradientTo})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {ctx.interpolate(props.headline)}
      </span>
    ) : (
      ctx.interpolate(props.headline)
    );

    const overlayBg = props.overlayColor;

    return (
      <section
        className="relative w-full h-[85vh] min-h-[500px] flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 text-center px-6"
        style={{ backgroundColor: '#070b15' }}
      >
        {/* Video Player */}
        {props.videoUrl ? (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <video
              src={props.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        {/* LightRays (WebGL Canvas) */}
        {props.lightRaysEnabled ? (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-80">
            <LightRays raysColor={props.lightRaysColor} />
          </div>
        ) : null}

        {/* Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ backgroundColor: overlayBg }}
        />

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto flex flex-col items-center gap-6">
          {isEdit ? (
            <>
              <input
                className="w-full text-4xl md:text-6xl font-black bg-transparent border-none outline-none focus:ring-0 text-center"
                style={textStyle}
                value={props.headline}
                onChange={(e) => ctx.onPropChange?.({ headline: e.target.value })}
              />
              <textarea
                className="w-full text-base bg-transparent border-none outline-none focus:ring-0 resize-none text-center opacity-80 text-white max-w-xl"
                value={props.subheadline}
                rows={2}
                onChange={(e) => ctx.onPropChange?.({ subheadline: e.target.value })}
              />
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight" style={textStyle}>
                {headlineMarkup}
              </h1>
              {props.subheadline ? (
                <p className="text-base md:text-lg text-slate-300 max-w-xl leading-relaxed">
                  {ctx.interpolate(props.subheadline)}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Scroll Indicator */}
        {props.showScrollIndicator && !isEdit ? (
          <a
            href={props.scrollTarget}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors animate-bounce motion-reduce:animate-none"
            aria-label="Scroll to next section"
          >
            <span>Learn More</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        ) : null}
      </section>
    );
  },
});
