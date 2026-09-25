'use client';

import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Film, Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
import VideoEmbed, { VideoPlayButtonOverlay } from '@/components/video-embed';
import { registerBlock } from '../registry';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadPageMedia } from '../upload';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { cn } from '@/lib/utils';

export type VideoPresetArchetypeId =
  | 'ambient-loop'
  | 'hero-walkthrough'
  | 'social-reel'
  | 'micro-demo';

export type VideoPlayButtonArchetype =
  | 'pulse'
  | 'glass-pill'
  | 'minimal-badge'
  | 'standard';

export type VideoControlsTheme =
  | 'standard'
  | 'minimal-line'
  | 'ghost'
  | 'floating-island';

export interface VideoPresetBundleAttributes {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  elevation: 'none' | 'hairline' | 'shadow' | 'browser' | 'mobile';
  borderRadius: 'none' | 'rounded' | 'squircle';
  playMode: 'inline' | 'modal';
  autoPlay: boolean;
  muted: boolean;
  loop: boolean;
  ambientGlow: boolean;
  hoverPreview: boolean;
  playButtonArchetype: VideoPlayButtonArchetype;
  controlsTheme: VideoControlsTheme;
  overlayTint: 'none' | 'dark-30' | 'dark-50';
}

export const VIDEO_PRESET_BUNDLES: Record<VideoPresetArchetypeId, VideoPresetBundleAttributes> = {
  'ambient-loop': {
    aspectRatio: '16:9',
    elevation: 'none',
    borderRadius: 'rounded',
    playMode: 'inline',
    autoPlay: true,
    muted: true,
    loop: true,
    ambientGlow: true,
    hoverPreview: false,
    playButtonArchetype: 'standard',
    controlsTheme: 'minimal-line',
    overlayTint: 'dark-30',
  },
  'hero-walkthrough': {
    aspectRatio: '16:9',
    elevation: 'browser',
    borderRadius: 'rounded',
    playMode: 'inline',
    autoPlay: false,
    muted: false,
    loop: false,
    ambientGlow: false,
    hoverPreview: false,
    playButtonArchetype: 'pulse',
    controlsTheme: 'standard',
    overlayTint: 'none',
  },
  'social-reel': {
    aspectRatio: '9:16',
    elevation: 'mobile',
    borderRadius: 'squircle',
    playMode: 'inline',
    autoPlay: true,
    muted: true,
    loop: true,
    ambientGlow: false,
    hoverPreview: false,
    playButtonArchetype: 'minimal-badge',
    controlsTheme: 'ghost',
    overlayTint: 'none',
  },
  'micro-demo': {
    aspectRatio: '16:9',
    elevation: 'hairline',
    borderRadius: 'rounded',
    playMode: 'inline',
    autoPlay: false,
    muted: true,
    loop: true,
    ambientGlow: false,
    hoverPreview: true,
    playButtonArchetype: 'glass-pill',
    controlsTheme: 'minimal-line',
    overlayTint: 'none',
  },
};

const rawSchema = z.object({
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  titlePosition: z.enum(['top', 'bottom', 'overlay']).default('overlay').optional(),
  videoData: z.object({
    videoUrl: z.string().default(''),
    thumbnailUrl: z.string().default(''),
    title: z.string().default(''),
    description: z.string().default(''),
    titlePosition: z.enum(['top', 'bottom', 'overlay']).default('overlay').optional(),
  }).default({}),
  provider: z.enum(['youtube', 'vimeo', 'loom']).default('youtube'),
  preset: z.enum(['ambient-loop', 'hero-walkthrough', 'social-reel', 'micro-demo']).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).optional(),
  elevation: z.enum(['none', 'hairline', 'shadow', 'browser', 'mobile']).optional(),
  borderRadius: z.enum(['none', 'rounded', 'squircle']).optional(),
  playMode: z.enum(['inline', 'modal']).optional(),
  autoPlay: z.boolean().optional(),
  muted: z.boolean().optional(),
  loop: z.boolean().optional(),
  ambientGlow: z.boolean().optional(),
  hoverPreview: z.boolean().optional(),
  playButtonArchetype: z.enum(['pulse', 'glass-pill', 'minimal-badge', 'standard']).optional(),
  controlsTheme: z.enum(['standard', 'minimal-line', 'ghost', 'floating-island']).optional(),
  overlayTint: z.enum(['none', 'dark-30', 'dark-50']).optional(),
});

// Baseline defaults matching hero-walkthrough used to detect untouched fields during BlockRenderer defaults merging
const BASELINE_DEFAULTS = VIDEO_PRESET_BUNDLES['hero-walkthrough'];

const schema = rawSchema.transform((val) => {
  const presetKey: VideoPresetArchetypeId = val.preset || 'hero-walkthrough';
  const bundle = VIDEO_PRESET_BUNDLES[presetKey];

  // If preset is explicitly specified and not hero-walkthrough,
  // we check if attributes match baseline hero-walkthrough defaults (which came from def.defaults in BlockRenderer).
  // If they match baseline defaults, we adopt the target preset bundle's attributes.
  const isPresetCustom = Boolean(val.preset && val.preset !== 'hero-walkthrough');

  const resolveAttr = <K extends keyof VideoPresetBundleAttributes>(
    key: K,
    valAttr: VideoPresetBundleAttributes[K] | undefined
  ): VideoPresetBundleAttributes[K] => {
    if (valAttr === undefined) {
      return bundle[key];
    }
    if (isPresetCustom && valAttr === BASELINE_DEFAULTS[key]) {
      return bundle[key];
    }
    return valAttr;
  };

  return {
    ...val,
    preset: presetKey,
    aspectRatio: resolveAttr('aspectRatio', val.aspectRatio),
    elevation: resolveAttr('elevation', val.elevation),
    borderRadius: resolveAttr('borderRadius', val.borderRadius),
    playMode: resolveAttr('playMode', val.playMode),
    autoPlay: resolveAttr('autoPlay', val.autoPlay),
    muted: resolveAttr('muted', val.muted),
    loop: resolveAttr('loop', val.loop),
    ambientGlow: resolveAttr('ambientGlow', val.ambientGlow),
    hoverPreview: resolveAttr('hoverPreview', val.hoverPreview),
    playButtonArchetype: resolveAttr('playButtonArchetype', val.playButtonArchetype),
    controlsTheme: resolveAttr('controlsTheme', val.controlsTheme),
    overlayTint: resolveAttr('overlayTint', val.overlayTint),
  };
});

type VideoProps = z.infer<typeof schema>;

registerBlock({
  type: 'video',
  label: 'Video',
  category: 'content',
  icon: Film,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Preset Archetype',
      options: [
        { value: 'ambient-loop', label: 'Ambient Background Loop' },
        { value: 'hero-walkthrough', label: 'Hero Walkthrough' },
        { value: 'social-reel', label: 'Social Reel / Story' },
        { value: 'micro-demo', label: 'Interactive Micro-Demo' },
      ],
    },
    { kind: 'video', key: 'videoData', label: 'Video & Cover Settings' },
    {
      kind: 'select',
      key: 'aspectRatio',
      label: 'Aspect Ratio',
      options: [
        { value: '16:9', label: '16:9 Widescreen' },
        { value: '9:16', label: '9:16 Vertical (Reel/Story)' },
        { value: '1:1', label: '1:1 Square' },
        { value: '4:3', label: '4:3 Classic' },
      ],
    },
    {
      kind: 'select',
      key: 'elevation',
      label: 'Elevation & Frame',
      options: [
        { value: 'none', label: 'None (Flat)' },
        { value: 'hairline', label: 'Hairline Border' },
        { value: 'shadow', label: 'Floating Deep Shadow' },
        { value: 'browser', label: 'Desktop Browser Window' },
        { value: 'mobile', label: 'Smartphone Chassis' },
      ],
    },
    {
      kind: 'select',
      key: 'playMode',
      label: 'Playback Mode',
      options: [
        { value: 'inline', label: 'Play Inline' },
        { value: 'modal', label: 'Play in Pop-up Modal' },
      ],
    },
    {
      kind: 'select',
      key: 'playButtonArchetype',
      label: 'Play Button Trigger Style',
      options: [
        { value: 'pulse', label: 'Radar / Pulse Waves' },
        { value: 'glass-pill', label: 'Glassmorphic Pill' },
        { value: 'minimal-badge', label: 'Minimal Bottom Badge' },
        { value: 'standard', label: 'Classic Disc' },
      ],
    },
    {
      kind: 'boolean',
      key: 'ambientGlow',
      label: 'Ambient Reactive Glow',
    },
    {
      kind: 'boolean',
      key: 'hoverPreview',
      label: 'Kinetic Hover Preview',
    },
    {
      kind: 'select',
      key: 'controlsTheme',
      label: 'Control Bar Theme',
      options: [
        { value: 'standard', label: 'Standard Controls' },
        { value: 'minimal-line', label: 'Minimalist Bottom Line' },
        { value: 'ghost', label: 'Ghost (Reveal on Hover)' },
        { value: 'floating-island', label: 'Floating Glass Capsule' },
      ],
    },
    {
      kind: 'select',
      key: 'overlayTint',
      label: 'Dark Tint Overlay',
      options: [
        { value: 'none', label: 'None' },
        { value: 'dark-30', label: '30% Dark Tint' },
        { value: 'dark-50', label: '50% Dark Tint' },
      ],
    },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: VideoProps, _block, ctx) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [videoLibraryOpen, setVideoLibraryOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [modalOpen, setModalOpen] = useState(false);

    const finalVideoUrl = props.videoData?.videoUrl || props.url || '';
    const finalThumbnailUrl = props.videoData?.thumbnailUrl || props.thumbnailUrl || '';

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [changeSourceOpen, setChangeSourceOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [showLinkInput, setShowLinkInput] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [pastedLink, setPastedLink] = useState('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const fileInputRef = useRef<HTMLInputElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const linkInputRef = useRef<HTMLInputElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { toast } = useToast();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (showLinkInput) {
        // Cautious: Wait briefly for the UI rendering pass to place focus inside the textbox
        const timer = setTimeout(() => {
          linkInputRef.current?.focus();
        }, 50);

        // Safely capture clipboard contents if it is a link
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText()
            .then((text) => {
              const trimmed = text?.trim();
              if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                setPastedLink(trimmed);
              }
            })
            .catch((err) => {
              console.warn('Clipboard auto-read declined or blocked:', err);
            });
        }

        return () => clearTimeout(timer);
      }
    }, [showLinkInput]);

    const handleApplyLink = () => {
      if (!pastedLink) return;
      const url = pastedLink.trim();
      let derivedThumb = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
      const match = url.match(regExp);
      const ytid = match && match[2].length === 11 ? match[2] : null;
      if (ytid) {
        derivedThumb = `https://img.youtube.com/vi/${ytid}/maxresdefault.jpg`;
      }
      ctx.onPropChange?.({
        videoData: {
          videoUrl: url,
          thumbnailUrl: derivedThumb,
          title: props.videoData?.title || '',
          description: props.videoData?.description || '',
          titlePosition: props.videoData?.titlePosition || props.titlePosition || 'overlay',
        }
      });
      setChangeSourceOpen(false);
      setShowLinkInput(false);
      setPastedLink('');
      toast({
        title: 'Video link applied',
        description: 'Successfully set the direct video URL.'
      });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      toast({
        title: "Uploading video…",
        description: `Uploading ${file.name} to media…`,
      });
      
      try {
        const downloadUrl = await uploadPageMedia(file, ctx.page?.workspaceId || '', (_percent) => {});
        
        ctx.onPropChange?.({
          videoData: {
            videoUrl: downloadUrl,
            thumbnailUrl: '', // Reset thumbnail for new file upload
            title: props.videoData?.title || '',
            description: props.videoData?.description || '',
            titlePosition: props.videoData?.titlePosition || props.titlePosition || 'overlay',
          }
        });
        
        toast({
          title: "Video uploaded successfully",
          description: `${file.name} has been applied.`,
        });
        setChangeSourceOpen(false);
      } catch (err) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "An error occurred during file upload.",
        });
      }
    };

    const changeControls = ctx.mode === 'edit' && ctx.page?.workspaceId && (
      <div className="contents" onClick={(e) => e.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 p-1 rounded-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setChangeSourceOpen(true); }}
            className="px-2 py-1 text-[9px] font-bold text-white hover:text-emerald-400 transition-colors"
          >
            Change Video
          </button>
        </div>

        <Dialog open={changeSourceOpen} onOpenChange={(open) => { setChangeSourceOpen(open); if (!open) setShowLinkInput(false); }}>
          <DialogContent className="max-w-md p-6 bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Change Video Source</DialogTitle>
            {!showLinkInput ? (
              <div className="flex flex-col gap-3 mt-4">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 shadow-md shadow-emerald-500/10"
                >
                  <Upload className="w-4 h-4" /> Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // CAUTION: Decouple dialog teardown to prevent Radix UI focus trap race conditions
                    setChangeSourceOpen(false);
                    setTimeout(() => {
                      setVideoLibraryOpen(true);
                    }, 50);
                  }}
                  className="w-full h-12 rounded-xl text-xs font-bold bg-slate-800/85 border border-slate-700/80 text-slate-200 hover:bg-slate-750 hover:border-emerald-500/50 hover:text-white flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
                >
                  <FolderHeart className="w-4 h-4 text-emerald-500" /> Library
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLinkInput(true)}
                  className="w-full h-12 rounded-xl text-xs font-bold bg-slate-800/85 border border-slate-700/80 text-slate-200 hover:bg-slate-750 hover:border-emerald-500/50 hover:text-white flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
                >
                  <LinkIcon className="w-4 h-4 text-emerald-500" /> Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-left">
                <p className="text-xs text-slate-400">Paste a link to YouTube, Vimeo, Loom, or a direct video URL:</p>
                <Input
                  autoFocus
                  ref={linkInputRef}
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={pastedLink}
                  onChange={(e) => setPastedLink(e.target.value)}
                  className="h-10 rounded-xl bg-slate-850 border-slate-800 text-xs font-semibold text-slate-200 focus-visible:ring-emerald-500/30"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowLinkInput(false);
                      setPastedLink('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApplyLink}
                    className="rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    Apply URL
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <MediaSelectorDialog
          open={videoLibraryOpen}
          onOpenChange={(open) => {
            setVideoLibraryOpen(open);
            if (!open && typeof document !== 'undefined') {
              setTimeout(() => { document.body.style.pointerEvents = ''; }, 50);
            }
          }}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({
              videoData: {
                videoUrl: asset.url,
                thumbnailUrl: '', // Reset thumbnail for new video selection
                title: props.videoData?.title || '',
                description: props.videoData?.description || '',
                titlePosition: props.videoData?.titlePosition || props.titlePosition || 'overlay',
              }
            });
            setVideoLibraryOpen(false);
            if (typeof document !== 'undefined') {
              setTimeout(() => { document.body.style.pointerEvents = ''; }, 50);
            }
          }}
          filterType="video"
          workspaceId={ctx.page.workspaceId}
        />
      </div>
    );

    if (!finalVideoUrl) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <>
          <div 
            onClick={() => setChangeSourceOpen(true)}
            className="h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-850 transition-colors"
          >
            <Film className="w-8 h-8 text-slate-600 animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Click to select video source</span>
          </div>
          {changeControls}
        </>
      );
    }

    const playInline = props.playMode === 'inline';
    const rawTitle = props.videoData?.title?.trim() || props.title?.trim() || '';
    const rawDescription = props.videoData?.description?.trim() || props.description?.trim() || '';
    const position = props.videoData?.titlePosition || props.titlePosition || 'overlay';

    const displayTitle = ctx.interpolate ? ctx.interpolate(rawTitle) : rawTitle;
    const displayDescription = ctx.interpolate ? ctx.interpolate(rawDescription) : rawDescription;
    const hasText = Boolean(displayTitle || displayDescription);
    const isOverlay = position === 'overlay';

    // Responsive aspect ratio container class
    const aspectRatioClass = {
      '16:9': 'aspect-video w-full',
      '9:16': 'aspect-[9/16] w-full max-w-[340px] sm:max-w-[380px] mx-auto',
      '1:1': 'aspect-square w-full max-w-[480px] mx-auto',
      '4:3': 'aspect-[4/3] w-full max-w-[640px] mx-auto',
    }[props.aspectRatio || '16:9'];

    // Border radius mapping
    const borderRadiusClass = props.elevation === 'browser'
      ? 'rounded-2xl'
      : props.elevation === 'mobile'
      ? 'rounded-[2.5rem]'
      : {
          none: 'rounded-none',
          rounded: 'rounded-2xl',
          squircle: 'rounded-[2rem]',
        }[props.borderRadius || 'rounded'];

    // Elevation framing classes
    const elevationClass = {
      none: 'border-0 shadow-none',
      hairline: 'border border-black/10 dark:border-white/10 shadow-2xs',
      shadow: 'shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-black/10 dark:border-white/10',
      browser: 'border border-slate-300 dark:border-slate-700 shadow-xl',
      mobile: 'border-[6px] sm:border-[8px] border-slate-900 shadow-2xl',
    }[props.elevation || 'none'];

    return (
      <div className="w-full text-left space-y-2 relative">
        {/* Reactive Ambient Glow Aura */}
        {props.ambientGlow && (
          <div
            data-testid="ambient-reactive-glow"
            aria-hidden="true"
            className="absolute -inset-4 sm:-inset-6 rounded-3xl bg-radial from-primary/30 via-primary/10 to-transparent blur-2xl opacity-60 pointer-events-none -z-10 scale-105 motion-reduce:hidden will-change-transform transform-gpu"
          />
        )}

        {/* Top Title & Description */}
        {hasText && position === 'top' && (
          <div className="space-y-1 mb-2">
            {displayTitle && (
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground leading-snug tracking-tight">
                {displayTitle}
              </h3>
            )}
            {displayDescription && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {displayDescription}
              </p>
            )}
          </div>
        )}

        {/* Video Player / Device Frame Outer Shell */}
        <div
          className={cn(
            "group overflow-hidden bg-black relative flex flex-col",
            aspectRatioClass,
            borderRadiusClass,
            elevationClass
          )}
        >
          {/* Desktop Browser Window Chrome Header */}
          {props.elevation === 'browser' && (
            <div
              data-testid="browser-chrome-header"
              className="h-7 px-3 bg-slate-200/90 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700/80 flex items-center gap-1.5 select-none z-20 shrink-0 relative"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-black/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-black/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-black/10" />
              </div>
              <div className="flex-1 flex justify-center px-4">
                <div className="w-full max-w-[280px] h-4 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center px-2">
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    https://player.smartsapp.com
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Smartphone Chassis Speaker Bar */}
          {props.elevation === 'mobile' && (
            <div
              data-testid="mobile-speaker-bar"
              className="h-5 bg-slate-950 w-full flex items-center justify-center select-none z-20 shrink-0 relative"
            >
              <div className="w-12 h-1 rounded-full bg-slate-700" />
            </div>
          )}

          {/* Viewport Area */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            {playInline ? (
              <VideoEmbed
                url={finalVideoUrl}
                thumbnailUrl={finalThumbnailUrl || undefined}
                disabled={ctx.mode === 'edit' || ctx.isThumbnail}
                title={displayTitle}
                description={displayDescription}
                showOverlayText={isOverlay && hasText}
                autoPlay={ctx.mode !== 'edit' && !ctx.isThumbnail && props.autoPlay}
                muted={props.muted}
                loop={props.loop}
                hoverPreview={ctx.mode !== 'edit' && !ctx.isThumbnail && props.hoverPreview}
                playButtonArchetype={props.playButtonArchetype}
                controlsTheme={props.controlsTheme}
                overlayTint={props.overlayTint}
                className="w-full h-full aspect-auto border-0 rounded-none shadow-none"
              />
            ) : (
              <>
                <div 
                  onClick={() => {
                    if (ctx.mode === 'edit' || ctx.isThumbnail) return;
                    setModalOpen(true);
                  }}
                  className="absolute inset-0 w-full h-full cursor-pointer overflow-hidden group shadow-sm transition-all"
                >
                  {finalThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={finalThumbnailUrl} 
                      alt={displayTitle || "Video thumbnail preview"} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                      <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Watch Video Tutorial</span>
                    </div>
                  )}

                  {/* Dark Tint Overlay on Thumbnail */}
                  {props.overlayTint === 'dark-30' && (
                    <div className="absolute inset-0 bg-black/30 pointer-events-none z-10" />
                  )}
                  {props.overlayTint === 'dark-50' && (
                    <div className="absolute inset-0 bg-black/50 pointer-events-none z-10" />
                  )}

                  <VideoPlayButtonOverlay
                    archetype={props.playButtonArchetype}
                    label={props.playButtonArchetype === 'standard' ? "TAP TO WATCH VIDEO" : undefined}
                  />

                  {/* Overlay Title & Description on Thumbnail */}
                  {isOverlay && hasText && (
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none z-10 text-left">
                      {displayTitle && (
                        <h3 className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow line-clamp-2 leading-snug">
                          {displayTitle}
                        </h3>
                      )}
                      {displayDescription && (
                        <p className="text-xs sm:text-sm text-white/85 line-clamp-2 mt-1 leading-snug drop-shadow-sm">
                          {displayDescription}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                  <DialogContent className="max-w-3xl aspect-video p-0 overflow-hidden bg-black border border-slate-800 rounded-2xl">
                    <DialogTitle className="sr-only">Video Player</DialogTitle>
                    {/* CAUTION: Use VideoEmbed instead of raw iframe to transform YouTube watch URLs into embed URLs and render HTML5 video players for hosted MP4 files */}
                    {modalOpen && (
                      <VideoEmbed
                        url={finalVideoUrl}
                        thumbnailUrl={finalThumbnailUrl || undefined}
                        autoPlay={true}
                        disabled={false}
                        className="w-full h-full aspect-auto border-0 rounded-none shadow-none"
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </>
            )}
            {changeControls}
          </div>
        </div>

        {/* Bottom Title & Description */}
        {hasText && position === 'bottom' && (
          <div className="space-y-1 mt-2">
            {displayTitle && (
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground leading-snug tracking-tight">
                {displayTitle}
              </h3>
            )}
            {displayDescription && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {displayDescription}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
});
