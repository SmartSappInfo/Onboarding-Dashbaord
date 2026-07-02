'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerBlock, type BlockRenderContext } from '../registry';
import type { PageBlock } from '@/lib/types';
import { RawDebouncedInput, RawDebouncedTextarea } from '@/components/page-builder/DebouncedInputs';

const schema = z.object({
  heading:              z.string().default('Get Started Today'),
  subtext:              z.string().default('Download the SmartSapp mobile app to complete profile setups, nominal rolls, and more.'),
  backgroundImageUrl:   z.string().default(''),
  overlayColor:         z.string().default('#0A1427'),
  overlayOpacity:       z.number().min(0).max(1).default(0.8),
  parallaxEnabled:      z.boolean().default(true),
  stepNumber:           z.number().int().min(0).default(0), // 0 is hidden
  iosUrl:               z.string().default('https://apps.apple.com'),
  androidUrl:           z.string().default('https://play.google.com'),
  showAppStoreBadges:   z.boolean().default(true),
});
type AppDownloadProps = z.infer<typeof schema>;

// Module-level static SVGs for variants (rerender-no-inline-components)
const ParallaxThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="0" y="0" width="100" height="75" rx="4" className="text-slate-850" />
    <circle cx="20" cy="20" r="6" className="text-emerald-500/20" />
    <rect x="15" y="32" width="70" height="5" rx="1.5" />
    <rect x="25" y="42" width="50" height="4" rx="1.5" />
    <rect x="30" y="52" width="18" height="6" rx="1.5" className="text-slate-650" />
    <rect x="52" y="52" width="18" height="6" rx="1.5" className="text-slate-655" />
  </svg>
);

const FlatCardThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="8" y="12" width="84" height="51" rx="3.5" className="text-slate-800" />
    <circle cx="50" cy="24" r="5" className="text-slate-700" />
    <rect x="20" y="36" width="60" height="4" rx="1" />
    <rect x="35" y="44" width="30" height="3" rx="1" />
  </svg>
);

registerBlock({
  type: 'app_download',
  label: 'App Download',
  category: 'content',
  icon: Download,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtext', label: 'Section Subtext' },
    { kind: 'image', key: 'backgroundImageUrl', label: 'Background Image' },
    { kind: 'color', key: 'overlayColor', label: 'Overlay Color' },
    { kind: 'slider', key: 'overlayOpacity', label: 'Overlay Opacity', min: 0, max: 1, step: 0.1 },
    { kind: 'boolean', key: 'parallaxEnabled', label: 'Enable Parallax (fixed background)' },
    { kind: 'number', key: 'stepNumber', label: 'Step Number Badge (0 = hide)' },
    { kind: 'url', key: 'iosUrl', label: 'iOS Store Link' },
    { kind: 'url', key: 'androidUrl', label: 'Android Play Store Link' },
    { kind: 'boolean', key: 'showAppStoreBadges', label: 'Show App Badges Grid' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: AppDownloadProps, block, ctx) => (
    <AppDownloadBlock props={props} block={block} ctx={ctx} />
  ),
});

interface AppDownloadBlockProps {
  props: AppDownloadProps;
  block: PageBlock;
  ctx: BlockRenderContext;
}

const AppDownloadBlock = ({ props, block, ctx }: AppDownloadBlockProps) => {
  const isEdit = ctx.mode === 'edit';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    backgroundImage: props.backgroundImageUrl ? `url(${props.backgroundImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: props.parallaxEnabled && mounted ? 'fixed' : 'scroll',
  };

  return (
    <section
      style={props.backgroundImageUrl ? containerStyle : undefined}
      className={cn(
        'w-full rounded-3xl overflow-hidden py-16 px-8 relative text-center border border-slate-800 flex flex-col items-center justify-center gap-6 shadow-2xl',
        !props.backgroundImageUrl && 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900'
      )}
    >
      {/* Color Overlay */}
      {props.backgroundImageUrl ? (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundColor: props.overlayColor, opacity: props.overlayOpacity }}
        />
      ) : null}

      {/* Content details */}
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center gap-4">
        
        {/* Step Badge */}
        {props.stepNumber > 0 ? (
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] select-none">
            {props.stepNumber}
          </div>
        ) : null}

        {isEdit ? (
          <>
            <RawDebouncedInput
              className="w-full text-2xl md:text-4xl font-black bg-transparent border-none outline-none focus:ring-0 text-center text-white"
              value={props.heading}
              onChange={(value) => ctx.onPropChange?.({ heading: value })}
            />
            <RawDebouncedTextarea
              className="w-full text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 resize-none text-center text-slate-300 opacity-80"
              value={props.subtext}
              rows={2}
              onChange={(value) => ctx.onPropChange?.({ subtext: value })}
            />
          </>
        ) : (
          <>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
              {ctx.interpolate(props.heading)}
            </h2>
            {props.subtext ? (
              <p className="text-xs font-semibold text-slate-300 max-w-lg leading-relaxed">
                {ctx.interpolate(props.subtext)}
              </p>
            ) : null}
          </>
        )}

        {/* App download badges row */}
        {props.showAppStoreBadges ? (
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {props.iosUrl ? (
              <a
                href={props.iosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 hover:opacity-90 active:scale-95 transition-all"
                aria-label="Download on the App Store"
              >
                <img
                  src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83"
                  alt="Download on the App Store"
                  className="h-full object-contain"
                />
              </a>
            ) : null}
            {props.androidUrl ? (
              <a
                href={props.androidUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 hover:opacity-90 active:scale-95 transition-all"
                aria-label="Get it on Google Play"
              >
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  className="h-full object-contain -my-2.5"
                />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};
