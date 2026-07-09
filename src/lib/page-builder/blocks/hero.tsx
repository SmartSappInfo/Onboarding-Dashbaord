'use client';

import React from 'react';
import { z } from 'zod';
import { Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { registerBlock } from '../registry';
import { RawDebouncedInput, RawDebouncedTextarea } from '@/components/page-builder/DebouncedInputs';
import VideoEmbed from '@/components/video-embed';

// Dynamic import for WebGL LightRays to prevent SSR hydration errors
const LightRays = dynamic(() => import('@/components/LightRays'), { ssr: false });

const schema = z.object({
  title:            z.string().default('New Hero'),
  subtitle:         z.string().default('Describe your campaign here.'),
  imageUrl:         z.string().default(''),
  align:            z.enum(['left', 'center', 'right']).default('center'),
  ctaText:          z.string().default(''),
  ctaUrl:           z.string().default(''),
  ctaSecondaryText: z.string().default(''),
  ctaSecondaryUrl:  z.string().default(''),
  videoUrl:         z.string().default(''),
  lightRaysEnabled: z.boolean().default(false),
  lightRaysColor:   z.string().default('#3B5FFF'),
  gradientText:     z.boolean().default(false),
  gradientFrom:     z.string().default('#3B5FFF'),
  gradientTo:       z.string().default('#7C3AED'),
  fontSize:         z.enum(['sm', 'md', 'lg', 'xl', '2xl']).default('xl'),
  isSplit:          z.boolean().default(false),

  // Sales Video Layout Extension
  isVideoSales:     z.boolean().default(false),
  secondaryTitle:   z.string().optional().default(''),
  secondarySubtitle:z.string().optional().default(''),
  bulletList:       z.string().optional().default(''),
}).catchall(z.unknown());

type HeroProps = z.infer<typeof schema>;

const ALIGN: Record<HeroProps['align'], string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
};

const FONT_SIZE: Record<HeroProps['fontSize'], string> = {
  sm: 'text-2xl md:text-3xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-5xl md:text-6xl',
  '2xl': 'text-6xl md:text-7xl',
};

// Markdown-like formatting helper for headings (*italic blue link style*, _solid blue style_)
const formatHeadlineText = (text: string) => {
  if (!text) return '';
  let html = text.replace(/\*([^*]+)\*/g, '<span class="text-[#3B5FFF] italic font-semibold">$1</span>');
  html = html.replace(/_([^_]+)_/g, '<span class="text-[#3B5FFF] font-bold">$1</span>');
  return html;
};

// Module-level static SVGs for variants (rerender-no-inline-components)
const CentredThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="10" y="20" width="80" height="8" rx="2" className="text-emerald-500" />
    <rect x="20" y="32" width="60" height="5" rx="1.5" />
    <rect x="30" y="40" width="40" height="5" rx="1.5" />
  </svg>
);

const VideoBgThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="0" y="0" width="100" height="75" rx="4" className="text-slate-800" />
    <circle cx="50" cy="37.5" r="8" className="text-slate-600" />
    <polygon points="48,34 55,37.5 48,41" className="text-slate-100" />
    <rect x="15" y="52" width="70" height="6" rx="1.5" className="text-slate-400" />
  </svg>
);

const ImageCtaThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="10" width="40" height="6" rx="1.5" className="text-slate-300" />
    <rect x="5" y="20" width="45" height="4" rx="1" />
    <rect x="5" y="27" width="30" height="4" rx="1" />
    <rect x="5" y="38" width="15" height="6" rx="2" className="text-emerald-500" />
    <rect x="25" y="38" width="15" height="6" rx="2" className="text-slate-500" />
    <rect x="55" y="10" width="40" height="55" rx="3" className="text-slate-800" />
  </svg>
);

const LightRaysThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <circle cx="50" cy="37.5" r="30" className="text-emerald-500/10" />
    <line x1="50" y1="37.5" x2="20" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2" />
    <line x1="50" y1="37.5" x2="80" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2" />
    <line x1="50" y1="37.5" x2="50" y2="70" stroke="currentColor" strokeWidth="1" strokeDasharray="2" />
    <rect x="20" y="25" width="60" height="8" rx="2" className="text-emerald-500" />
  </svg>
);

const SplitThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="5" y="20" width="40" height="6" rx="1.5" />
    <rect x="5" y="30" width="35" height="4" rx="1" />
    <rect x="5" y="37" width="20" height="4" rx="1" />
    <rect x="50" y="15" width="45" height="45" rx="3" className="text-slate-800" />
  </svg>
);

const VideoSalesThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-700 fill-current opacity-70">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="25" y="10" width="50" height="4" rx="1" className="text-white fill-white" />
    <rect x="35" y="16" width="30" height="2.5" rx="1" className="text-slate-500 fill-slate-500" />
    
    <rect x="25" y="24" width="50" height="24" rx="2" className="text-slate-800 fill-slate-800" />
    <polygon points="48,32 54,36 48,40" className="text-blue-500 fill-blue-500" />
    
    <rect x="30" y="52" width="40" height="3" rx="1" className="text-white fill-white" />
    <rect x="35" y="60" width="30" height="6" rx="2" className="text-blue-500 fill-blue-500" />
  </svg>
);

registerBlock({
  type: 'hero',
  label: 'Hero',
  category: 'content',
  icon: Zap,
  fields: [
    { kind: 'text', key: 'title', label: 'Headline' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    { kind: 'image', key: 'imageUrl', label: 'Background Image URL' },
    { kind: 'select', key: 'align', label: 'Alignment', options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ] },
    { kind: 'text', key: 'ctaText', label: 'Primary Button Label' },
    { kind: 'url', key: 'ctaUrl', label: 'Primary Button Link' },
    { kind: 'text', key: 'ctaSecondaryText', label: 'Secondary Button Label' },
    { kind: 'url', key: 'ctaSecondaryUrl', label: 'Secondary Button Link' },
    { kind: 'url', key: 'videoUrl', label: 'Video Resource Link' },
    { kind: 'boolean', key: 'lightRaysEnabled', label: 'Enable Light Rays' },
    { kind: 'color', key: 'lightRaysColor', label: 'Light Rays Color' },
    { kind: 'boolean', key: 'gradientText', label: 'Use Text Gradient' },
    { kind: 'color', key: 'gradientFrom', label: 'Gradient Color From' },
    { kind: 'color', key: 'gradientTo', label: 'Gradient Color To' },
    { kind: 'select', key: 'fontSize', label: 'Title Size', options: [
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' },
      { value: 'xl', label: 'Extra Large' },
      { value: '2xl', label: 'Double XL' },
    ] },
    { kind: 'boolean', key: 'isSplit', label: 'Split Layout (Text Left / Image Right)' },
    { kind: 'boolean', key: 'isVideoSales', label: 'Sales Video Funnel Mode' },
    { kind: 'text', key: 'secondaryTitle', label: 'Secondary Headline (Below Video)' },
    { kind: 'textarea', key: 'secondarySubtitle', label: 'Secondary Subtitle (Below Video)' },
    { kind: 'text', key: 'bulletList', label: 'Bullet Trust Points (Comma separated)' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'hero-centred', label: 'Centred Text', thumbnail: CentredThumbnail, defaults: { align: 'center', imageUrl: '' } },
    { id: 'hero-video-bg', label: 'Video Background', thumbnail: VideoBgThumbnail, defaults: { align: 'center', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4', lightRaysEnabled: false } },
    { id: 'hero-image-cta', label: 'Image + CTA', thumbnail: ImageCtaThumbnail, defaults: { align: 'left', ctaText: 'Get Started', ctaUrl: '#next', imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926' } },
    { id: 'hero-light-rays', label: 'Light Rays BG', thumbnail: LightRaysThumbnail, defaults: { align: 'center', lightRaysEnabled: true, gradientText: true } },
    { id: 'hero-split', label: 'Split Layout', thumbnail: SplitThumbnail, defaults: { align: 'left', isSplit: true, imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926' } },
    { 
      id: 'hero-video-sales', 
      label: 'Video Sales Funnel', 
      thumbnail: VideoSalesThumbnail, 
      defaults: { 
        align: 'center', 
        isVideoSales: true, 
        title: 'Why do parents choose *other schools* over yours?', 
        subtitle: 'Watch this short video to find out.', 
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', 
        secondaryTitle: 'Want to make your school the _preferred choice_ for parents in one term?', 
        secondarySubtitle: 'Book a FREE 30-minutes consultation to see your personalized roadmap to complete the shift.', 
        ctaText: 'Request Free Consultation Now', 
        ctaUrl: '#consultation', 
        bulletList: 'Personalized Roadmap, Complete the shift' 
      } 
    },
  ],
  render: (props: HeroProps, _block, ctx) => {
    const isEdit = ctx.mode === 'edit';
    const isVideoSales = props.isVideoSales;

    const textStyle = {
      color: props.imageUrl ? '#ffffff' : ctx.theme.colors.text,
      fontFamily: ctx.theme.typography.headingFont,
      textAlign: props.align,
    };

    const titleMarkup = props.gradientText ? (
      <span
        style={{
          background: `linear-gradient(135deg, ${props.gradientFrom}, ${props.gradientTo})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {ctx.interpolate(props.title)}
      </span>
    ) : (
      <span dangerouslySetInnerHTML={{ __html: formatHeadlineText(ctx.interpolate(props.title)) }} />
    );

    const ctaSectionMarkup = (props.ctaText || props.ctaSecondaryText) ? (
      <div className={cn('flex gap-3 mt-6 justify-center md:justify-start', props.align === 'center' && 'justify-center', props.align === 'right' && 'justify-end')}>
        {props.ctaText ? (
          <a
            href={props.ctaUrl}
            className="px-8 py-3.5 rounded-xl font-bold bg-[#3B5FFF] hover:bg-blue-600 text-white transition-all text-sm active:scale-95 duration-100 shadow-[0_4px_20px_rgba(59,95,255,0.35)] inline-flex items-center gap-2"
          >
            {ctx.interpolate(props.ctaText)}
            <span>→</span>
          </a>
        ) : null}
        {props.ctaSecondaryText ? (
          <a
            href={props.ctaSecondaryUrl}
            className="px-8 py-3.5 rounded-xl font-bold border border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-slate-300 transition-all text-sm active:scale-95 duration-100"
          >
            {ctx.interpolate(props.ctaSecondaryText)}
          </a>
        ) : null}
      </div>
    ) : null;

    const renderVideoPlayer = (url: string) => {
      if (!url) return null;
      return (
        <VideoEmbed
          url={url}
          disabled={ctx.mode === 'edit' || ctx.isThumbnail}
          className="absolute inset-0 w-full h-full border-none shadow-none"
        />
      );
    };

    const bulletItems = props.bulletList
      ? props.bulletList.split(',').map((it) => it.trim()).filter(Boolean)
      : [];

    const bulletsMarkup = bulletItems.length > 0 ? (
      <div className="flex flex-wrap gap-4 items-center justify-center mt-4 text-[10px] sm:text-xs font-bold text-slate-400">
        {bulletItems.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-500/5 px-3 py-1 rounded-full border border-slate-800">
            <span className="text-emerald-500 font-extrabold">✓</span>
            {item}
          </span>
        ))}
      </div>
    ) : null;

    // --- VIDEO SALES LAYOUT EDIT MODE ---
    if (isEdit && isVideoSales) {
      return (
        <div className="flex flex-col gap-6 py-8 px-4 border border-dashed border-slate-800 rounded-xl relative overflow-hidden bg-slate-950/20 text-center items-center">
          <div className="w-full max-w-3xl space-y-3">
            <h1
              className="w-full font-black tracking-tight text-3xl sm:text-4xl text-center placeholder:opacity-30 outline-none"
              style={{ color: textStyle.color, fontFamily: textStyle.fontFamily }}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="title"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ title: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.title || 'Why do parents choose *other schools* over yours?' }}
            />
            <p
              className="w-full text-sm text-center placeholder:opacity-30 opacity-70 outline-none"
              style={{ color: textStyle.color }}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="subtitle"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ subtitle: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.subtitle || 'Watch this short video to find out.' }}
            />
          </div>

          <div className="relative aspect-video w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
            {props.videoUrl ? (
              <div className="absolute inset-0 w-full h-full pointer-events-none">
                {renderVideoPlayer(props.videoUrl)}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No video configured yet. Specify a video link in block settings.</p>
            )}
          </div>

          <div className="w-full max-w-3xl space-y-3 mt-4">
            <h2
              className="w-full font-bold text-xl sm:text-2xl text-center placeholder:opacity-30 outline-none"
              style={{ color: textStyle.color, fontFamily: textStyle.fontFamily }}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="secondaryTitle"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ secondaryTitle: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.secondaryTitle || 'Want to make your school the preferred choice for parents in one term?' }}
            />
            <p
              className="w-full text-xs sm:text-sm text-center placeholder:opacity-30 opacity-70 outline-none min-h-[2.5rem]"
              style={{ color: textStyle.color }}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="secondarySubtitle"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ secondarySubtitle: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.secondarySubtitle || 'Book a FREE 30-minutes consultation to see your roadmap.' }}
            />
          </div>

          <div className="w-full flex flex-col items-center gap-4">
            {ctaSectionMarkup}
            <RawDebouncedInput
              className="w-full text-[10px] bg-transparent border-none outline-none focus:ring-0 text-center placeholder:opacity-30 opacity-50 font-bold"
              style={{ color: textStyle.color }}
              value={props.bulletList}
              placeholder="Personalized Roadmap, Complete the shift"
              onChange={(value) => ctx.onPropChange?.({ bulletList: value })}
            />
          </div>
        </div>
      );
    }

    // --- STANDARD HERO EDIT MODE ---
    if (isEdit) {
      return (
        <div className={cn('flex flex-col gap-3 py-8 px-4 border border-dashed border-slate-800 rounded-xl relative overflow-hidden bg-slate-950/20', ALIGN[props.align])}>
          {props.lightRaysEnabled ? (
            <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
              <LightRays raysColor={props.lightRaysColor} />
            </div>
          ) : null}
          <div className="relative z-10 w-full flex flex-col gap-3">
            <h1
              className={cn('w-full font-black tracking-tight placeholder:opacity-30 outline-none', FONT_SIZE[props.fontSize])}
              style={textStyle}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="title"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ title: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.title || 'Hero Title' }}
            />
            <p
              className="w-full text-sm placeholder:opacity-30 outline-none min-h-[3rem]"
              style={{ color: textStyle.color, textAlign: props.align, opacity: 0.7 }}
              contentEditable={isEdit}
              suppressContentEditableWarning
              data-block-id={_block.id}
              data-prop-key="subtitle"
              data-rich="true"
              onBlur={(e) => ctx.onPropChange?.({ subtitle: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: props.subtitle || 'Hero subtitle text' }}
            />
            {ctaSectionMarkup}
          </div>
        </div>
      );
    }

    // --- VIDEO SALES LAYOUT VIEW MODE ---
    if (isVideoSales) {
      return (
        <section className="w-full py-12 flex flex-col items-center text-center">
          <div className="w-full max-w-3xl space-y-4 px-4">
            <h1 
              className={cn('font-black tracking-tight leading-tight', FONT_SIZE[props.fontSize])} 
              style={{ color: textStyle.color, fontFamily: textStyle.fontFamily }}
            >
              {titleMarkup}
            </h1>
            {props.subtitle ? (
              <p className="text-base sm:text-lg text-slate-500 font-medium max-w-2xl mx-auto">
                {ctx.interpolate(props.subtitle)}
              </p>
            ) : null}
          </div>

          {props.videoUrl ? (
            <div className="w-full max-w-3xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 my-8 relative bg-slate-950">
              {renderVideoPlayer(props.videoUrl)}
            </div>
          ) : null}

          <div className="w-full max-w-3xl space-y-4 px-4">
            {props.secondaryTitle ? (
              <h2 
                className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white"
                style={{ fontFamily: textStyle.fontFamily }}
                dangerouslySetInnerHTML={{ __html: formatHeadlineText(ctx.interpolate(props.secondaryTitle)) }}
              />
            ) : null}
            {props.secondarySubtitle ? (
              <p className="text-sm sm:text-base text-slate-500 font-medium max-w-xl mx-auto">
                {ctx.interpolate(props.secondarySubtitle)}
              </p>
            ) : null}
          </div>

          <div className="w-full flex flex-col items-center gap-4 mt-6">
            {ctaSectionMarkup}
            {bulletsMarkup}
          </div>
        </section>
      );
    }

    // --- STANDARD HERO VIEW MODE ---
    const sectionContentMarkup = (
      <div className={cn('relative flex flex-col gap-4 py-20 px-8 rounded-2xl overflow-hidden', ALIGN[props.align])}>
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
        {props.lightRaysEnabled ? (
          <div className="absolute inset-0 pointer-events-none z-0">
            <LightRays raysColor={props.lightRaysColor} />
          </div>
        ) : null}
        {props.imageUrl || props.videoUrl ? <div className="absolute inset-0 bg-black/50 z-0" aria-hidden /> : null}

        <div className="relative z-10 w-full">
          <h1
            className={cn('font-black tracking-tight leading-tight', FONT_SIZE[props.fontSize])}
            style={textStyle}
          >
            {titleMarkup}
          </h1>
          {props.subtitle ? (
            <p
              className="mt-4 text-base md:text-lg max-w-2xl font-medium leading-relaxed"
              style={{ color: props.imageUrl ? '#e5e7eb' : ctx.theme.colors.text, opacity: props.imageUrl ? 1 : 0.7, textAlign: props.align }}
            >
              {ctx.interpolate(props.subtitle)}
            </p>
          ) : null}
          {ctaSectionMarkup}
        </div>
      </div>
    );

    if (props.isSplit) {
      return (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-12">
          <div className="flex flex-col gap-4 text-left">
            <h1 className={cn('font-black tracking-tight leading-tight', FONT_SIZE[props.fontSize])} style={{ ...textStyle, textAlign: 'left' }}>
              {titleMarkup}
            </h1>
            {props.subtitle ? (
              <p
                className="text-base md:text-lg font-medium leading-relaxed"
                style={{ color: ctx.theme.colors.text, opacity: 0.7, textAlign: 'left' }}
              >
                {ctx.interpolate(props.subtitle)}
              </p>
            ) : null}
            {ctaSectionMarkup}
          </div>
          {props.imageUrl ? (
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.imageUrl} alt="Hero split visual" className="w-full h-full object-cover" />
            </div>
          ) : null}
        </section>
      );
    }

    return (
      <section
        className="w-full"
        style={props.imageUrl && !props.videoUrl ? { backgroundImage: `url(${props.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {sectionContentMarkup}
      </section>
    );
  },
});
