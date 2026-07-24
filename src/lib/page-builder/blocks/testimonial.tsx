'use client';

import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Quote, Play, Edit, Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadPageMedia } from '../upload';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import VideoEmbed from '@/components/video-embed';
import { InlineEditable } from '@/components/page-builder/InlineEditable';
import { cn } from '@/lib/utils';

const getCardStyle = (props: {
  cardBgType?: 'default' | 'color' | 'gradient' | 'image';
  cardBgColor?: string;
  cardBgGradientFrom?: string;
  cardBgGradientTo?: string;
  cardBgImage?: string;
  cardBgImageOpacity?: number;
  cardTextColor?: string;
  cardBorderColor?: string;
}) => {
  const style: React.CSSProperties = {};
  if (props.cardTextColor) {
    style.color = props.cardTextColor;
  }
  if (props.cardBorderColor) {
    style.borderColor = props.cardBorderColor;
    style.borderStyle = 'solid';
    style.borderWidth = '1px';
  }
  if (props.cardBgType === 'color' && props.cardBgColor) {
    style.backgroundColor = props.cardBgColor;
    style.backgroundImage = 'none';
  } else if (props.cardBgType === 'gradient') {
    style.backgroundImage = `linear-gradient(135deg, ${props.cardBgGradientFrom || '#3b82f6'}, ${props.cardBgGradientTo || '#8b5cf6'})`;
    style.backgroundColor = 'transparent';
  } else if (props.cardBgType === 'image' && props.cardBgImage) {
    const tint = props.cardBgColor || '#0f172a';
    let rgbaTint = 'rgba(15, 23, 42, 0.5)';
    if (tint.startsWith('#')) {
      const r = parseInt(tint.slice(1, 3), 16);
      const g = parseInt(tint.slice(3, 5), 16);
      const b = parseInt(tint.slice(5, 7), 16);
      const opacity = (props.cardBgImageOpacity ?? 50) / 100;
      rgbaTint = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    style.backgroundImage = `linear-gradient(${rgbaTint}, ${rgbaTint}), url(${props.cardBgImage})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }
  return style;
};

const schema = z.object({
  quote: z.string().default(''),
  author: z.string().default(''),
  role: z.string().default(''),
  avatarUrl: z.string().default(''),
  videoUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  videoData: z.object({
    videoUrl: z.string().default(''),
    thumbnailUrl: z.string().default(''),
    title: z.string().default(''),
    description: z.string().default(''),
  }).default({}),
  playMode: z.enum(['inline', 'modal']).default('inline'),
  // New fields for the split-video layout
  preset: z.enum(['standard', 'split-video', 'horizontal-dark']).default('standard'),
  schoolName: z.string().default(''),
  schoolSubtitle: z.string().default(''),
  logoUrl: z.string().default(''),
  videoCaption: z.string().default(''),
  cardBgType: z.enum(['default', 'color', 'gradient', 'image']).default('default'),
  cardBgColor: z.string().default('#0f172a'),
  cardBgGradientFrom: z.string().default('#3b82f6'),
  cardBgGradientTo: z.string().default('#8b5cf6'),
  cardBgImage: z.string().default(''),
  cardBgImageOpacity: z.number().min(0).max(100).default(50),
  cardTextColor: z.string().default(''),
  cardBorderColor: z.string().default(''),
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

const SplitVideoTestimonialThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-900 fill-slate-900" />
    <rect x="8" y="15" width="40" height="45" rx="4" className="text-slate-800 fill-slate-800" />
    <rect x="52" y="15" width="40" height="45" rx="4" className="text-slate-800 fill-slate-800" />
    <polygon points="70,33 76,37.5 70,42" className="text-emerald-500 fill-emerald-500" />
    <circle cx="28" cy="25" r="4" className="text-slate-600 fill-slate-600" />
    <rect x="14" y="38" width="28" height="2" rx="0.5" className="text-slate-600 fill-slate-600" />
    <rect x="14" y="44" width="20" height="2" rx="0.5" className="text-slate-600 fill-slate-600" />
  </svg>
);

const HorizontalDarkTestimonialThumbnail = (
  <svg viewBox="0 0 100 75" className="w-full h-full text-slate-400 fill-current opacity-75">
    <rect x="0" y="0" width="100" height="75" rx="6" className="text-slate-950 fill-slate-950" />
    <rect x="8" y="22" width="20" height="20" rx="6" className="text-slate-800 fill-slate-800" />
    <rect x="36" y="24" width="56" height="3" rx="1" className="text-slate-200 fill-slate-200" />
    <rect x="36" y="32" width="46" height="3" rx="1" className="text-slate-200 fill-slate-200" />
    <line x1="36" y1="44" x2="92" y2="44" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.3" />
    <rect x="36" y="50" width="30" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
    <rect x="36" y="55" width="40" height="2" rx="0.5" className="text-slate-500 fill-slate-500" />
  </svg>
);

registerBlock({
  type: 'testimonial',
  label: 'Testimonial',
  category: 'data',
  icon: Quote,
  fields: [
    {
      kind: 'select',
      key: 'preset',
      label: 'Layout Style Preset',
      options: [
        { value: 'standard', label: 'Standard Text + Avatar' },
        { value: 'split-video', label: 'Sunflower Split Video Card' },
        { value: 'horizontal-dark', label: 'Horizontal Dark Gradient Card' }
      ]
    },
    { kind: 'textarea', key: 'quote', label: 'Quote Statement' },
    { kind: 'text', key: 'author', label: 'Author Name' },
    { kind: 'text', key: 'role', label: 'Role / Company' },
    { kind: 'image', key: 'avatarUrl', label: 'Avatar Image Source' },
    { kind: 'video', key: 'videoData', label: 'Video & Cover Settings' },
    { 
      kind: 'select', 
      key: 'playMode', 
      label: 'Video Playback Mode', 
      options: [
        { value: 'inline', label: 'Play Inline inside Card' },
        { value: 'modal', label: 'Play in Pop-up Modal' },
      ]
    },
    { kind: 'text', key: 'schoolName', label: 'School Name' },
    { kind: 'text', key: 'schoolSubtitle', label: 'School Subtitle (e.g. Country)' },
    { kind: 'image', key: 'logoUrl', label: 'School Logo' },
    { kind: 'text', key: 'videoCaption', label: 'Video Cover Caption Text' },
    {
      kind: 'select',
      key: 'cardBgType',
      label: 'Card Background Style',
      options: [
        { value: 'default', label: 'Default Theme' },
        { value: 'color', label: 'Solid Color' },
        { value: 'gradient', label: 'Gradient' },
        { value: 'image', label: 'Background Image' },
      ],
    },
    { kind: 'color', key: 'cardBgColor', label: 'Solid Color / Image Overlay Color' },
    { kind: 'color', key: 'cardBgGradientFrom', label: 'Gradient Color From' },
    { kind: 'color', key: 'cardBgGradientTo', label: 'Gradient Color To' },
    { kind: 'image', key: 'cardBgImage', label: 'Background Image Selector' },
    { kind: 'slider', key: 'cardBgImageOpacity', label: 'Image Overlay Opacity (%)', min: 0, max: 100, step: 5 },
    { kind: 'color', key: 'cardTextColor', label: 'Custom Text Color' },
    { kind: 'color', key: 'cardBorderColor', label: 'Custom Border Color' },
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'testi-standard', label: 'Text Quote + Avatar', thumbnail: StandardTestimonialThumbnail, defaults: { preset: 'standard', videoUrl: '', thumbnailUrl: '', playMode: 'inline' } },
    { id: 'testi-video', label: 'Video Testimonial Card', thumbnail: VideoTestimonialThumbnail, defaults: { preset: 'standard', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', playMode: 'inline' } },
    { 
      id: 'testi-split-video', 
      label: 'Split Video Card (Sunflower)', 
      thumbnail: SplitVideoTestimonialThumbnail, 
      defaults: { 
        preset: 'split-video',
        schoolName: 'Sunflower School',
        schoolSubtitle: 'Ghana',
        quote: 'Before SmartSapp, fee collection was a struggle. Now with drop-off denial, payment rates have soared and follow-ups are far easier. It\'s a game-changer!',
        author: 'Derick',
        role: 'Administrator',
        logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=100&h=100&q=80',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&h=400&q=80',
        videoCaption: 'How Sunflower School cleared their debtors lists without stress',
        playMode: 'modal'
      } 
    },
    {
      id: 'testi-horizontal-dark',
      label: 'Horizontal Dark Card (North Hills)',
      thumbnail: HorizontalDarkTestimonialThumbnail,
      defaults: {
        preset: 'horizontal-dark',
        quote: '"SmartSapp Fee Collection is the icing on the cake for me. It came to take the stress away from us, as far as fee collection is concerned"',
        author: 'Mrs. Bertha Kyei',
        role: 'Administrator',
        schoolName: 'North Hills International School',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&h=200&q=80',
        videoUrl: '',
        thumbnailUrl: '',
        playMode: 'inline'
      }
    }
  ],
  render: (props: TestimonialProps, _block, ctx) => {
    const finalVideoUrl = props.videoData?.videoUrl || props.videoUrl || '';
    const finalThumbnailUrl = props.videoData?.thumbnailUrl || props.thumbnailUrl || '';
    const hasVideo = finalVideoUrl;
    const playInline = props.playMode === 'inline';
    const isMobileOrTablet = ctx.viewport === 'mobile' || ctx.viewport === 'tablet';
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [modalOpen, setModalOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [videoLibraryOpen, setVideoLibraryOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [thumbnailLibraryOpen, setThumbnailLibraryOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [logoLibraryOpen, setLogoLibraryOpen] = useState(false);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [hasMounted, setHasMounted] = useState(false);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setHasMounted(true);
    }, []);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [changeSourceOpen, setChangeSourceOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [showLinkInput, setShowLinkInput] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [pastedLink, setPastedLink] = useState('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const fileInputRef = useRef<HTMLInputElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { toast } = useToast();

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
        const downloadUrl = await uploadPageMedia(file, ctx.page?.workspaceId || '', (percent) => {});
        
        ctx.onPropChange?.({
          videoData: {
            videoUrl: downloadUrl,
            thumbnailUrl: '', // Reset thumbnail for new file upload
            title: props.videoData?.title || '',
            description: props.videoData?.description || '',
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
      <>
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
          <span className="h-3 w-px bg-slate-700" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setThumbnailLibraryOpen(true); }}
            className="px-2 py-1 text-[9px] font-bold text-white hover:text-emerald-400 transition-colors"
          >
            Change Cover
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
                  className="w-full h-11 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Upload Video File
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangeSourceOpen(false);
                    setVideoLibraryOpen(true);
                  }}
                  className="w-full h-11 rounded-xl text-xs font-bold bg-slate-800 border-slate-750 text-slate-200 hover:bg-slate-750 flex items-center justify-center gap-2"
                >
                  <FolderHeart className="w-4 h-4 text-emerald-500" /> Select from Media Gallery
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLinkInput(true)}
                  className="w-full h-11 rounded-xl text-xs font-bold bg-slate-800 border-slate-750 text-slate-200 hover:bg-slate-750 flex items-center justify-center gap-2"
                >
                  <LinkIcon className="w-4 h-4 text-emerald-500" /> Paste Video Link (YouTube, Vimeo, etc.)
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-left">
                <p className="text-xs text-slate-400">Paste a link to YouTube, Vimeo, Loom, or a direct video URL:</p>
                <Input
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
          onOpenChange={setVideoLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({
              videoData: {
                videoUrl: asset.url,
                thumbnailUrl: '', // Reset thumbnail for new video selection
                title: props.videoData?.title || '',
                description: props.videoData?.description || '',
              }
            });
            setVideoLibraryOpen(false);
          }}
          filterType="video"
          workspaceId={ctx.page.workspaceId}
        />
        <MediaSelectorDialog
          open={thumbnailLibraryOpen}
          onOpenChange={setThumbnailLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({
              videoData: {
                videoUrl: props.videoData?.videoUrl || props.videoUrl || '',
                thumbnailUrl: asset.url,
                title: props.videoData?.title || '',
                description: props.videoData?.description || '',
              }
            });
            setThumbnailLibraryOpen(false);
          }}
          filterType="image"
          workspaceId={ctx.page.workspaceId}
        />
      </>
    );

    const isCustomBg = props.cardBgType && props.cardBgType !== 'default';

    const isDark = ctx.themeMode === 'dark';

    if (props.preset === 'horizontal-dark') {
      return (
        <div 
          className={cn(
            "max-w-5xl mx-auto p-6 md:p-8 rounded-3xl text-left flex gap-6 md:gap-8 shadow-2xl relative group/card font-figtree transition-colors duration-300",
            isMobileOrTablet ? "flex-col items-start" : "flex-col sm:flex-row items-center sm:items-start",
            isCustomBg ? "" : (isDark ? "bg-white" : "bg-gradient-to-br from-[#0B1528] to-[#1E2E4A]"),
            props.cardBorderColor ? "" : (isDark ? "border border-slate-200/60" : "border border-slate-800/40")
          )}
          style={getCardStyle(props)}
        >
          
          {/* Rounded Squircle Avatar/Image on the left */}
          <div className="relative group/avatar cursor-pointer shrink-0">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={props.avatarUrl} 
                alt={props.author} 
                className={cn(
                  "w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] object-cover shadow-lg transition-colors duration-300 border",
                  isDark ? "border-slate-200/60" : "border-white/10"
                )} 
              />
            ) : (
              <div className={cn(
                "w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] flex items-center justify-center text-xs font-bold shadow-lg transition-colors duration-300 border",
                isDark 
                  ? "bg-slate-100 border-slate-200 text-slate-500" 
                  : "bg-slate-850 border-slate-700/50 text-slate-400"
              )}>
                {props.author ? props.author.slice(0, 2).toUpperCase() : 'AN'}
              </div>
            )}
            {ctx.mode === 'edit' && ctx.page?.workspaceId && (
              <>
                <div 
                  onClick={(e) => { e.stopPropagation(); setAvatarLibraryOpen(true); }}
                  className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity z-10"
                >
                  <span className="text-[8px] font-bold text-white uppercase tracking-wider scale-90">Change</span>
                </div>
                <MediaSelectorDialog
                  open={avatarLibraryOpen}
                  onOpenChange={setAvatarLibraryOpen}
                  onSelectAsset={(asset) => {
                    ctx.onPropChange?.({ avatarUrl: asset.url });
                    setAvatarLibraryOpen(false);
                  }}
                  filterType="image"
                  workspaceId={ctx.page.workspaceId}
                />
              </>
            )}
          </div>

          {/* Testimonial content on the right */}
          <div className="flex-1 w-full self-stretch flex flex-col justify-between py-1">
            {/* Quote block */}
            <div className="mb-4">
              <InlineEditable
                tagName="blockquote"
                isEdit={ctx.mode === 'edit'}
                data-block-id={_block.id}
                data-prop-key="quote"
                data-rich="true"
                onChange={(val) => ctx.onPropChange?.({ quote: val })}
                className={cn(
                  "text-base md:text-lg font-normal leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 w-full transition-colors duration-300", 
                  props.cardTextColor ? "" : (isDark ? "text-slate-900" : "text-slate-100")
                )}
                value={ctx.mode === 'edit' ? props.quote : ctx.interpolate(props.quote)}
                html={true}
              />
            </div>

            {/* Horizontal line divider */}
            <div className={cn(
              "border-t w-full my-4 transition-colors duration-300",
              isDark ? "border-slate-200" : "border-white/10"
            )} />

            {/* Author, Role & School Name Info */}
            <div className="text-left space-y-0.5">
              <div className={cn(
                "text-xs md:text-sm font-semibold flex items-center gap-1 transition-colors duration-300", 
                props.cardTextColor ? "" : (isDark ? "text-slate-600" : "text-slate-300")
              )}>
                <InlineEditable
                  tagName="span"
                  isEdit={ctx.mode === 'edit'}
                  data-block-id={_block.id}
                  data-prop-key="author"
                  data-rich="false"
                  onChange={(val) => ctx.onPropChange?.({ author: val })}
                  className={cn(
                    "outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text font-bold transition-colors duration-300", 
                    props.cardTextColor ? "" : (isDark ? "text-slate-900" : "text-white")
                  )}
                  value={props.author || 'Author Name'}
                  html={false}
                />
                <span>,</span>
                <InlineEditable
                  tagName="span"
                  isEdit={ctx.mode === 'edit'}
                  data-block-id={_block.id}
                  data-prop-key="role"
                  data-rich="false"
                  onChange={(val) => ctx.onPropChange?.({ role: val })}
                  className={cn(
                    "outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text font-normal transition-colors duration-300", 
                    props.cardTextColor ? "" : (isDark ? "text-slate-600" : "text-slate-400")
                  )}
                  value={props.role || 'Role'}
                  html={false}
                />
              </div>

              {/* School Name */}
              <div>
                <InlineEditable
                  tagName="p"
                  isEdit={ctx.mode === 'edit'}
                  data-block-id={_block.id}
                  data-prop-key="schoolName"
                  data-rich="false"
                  onChange={(val) => ctx.onPropChange?.({ schoolName: val })}
                  className={cn(
                    "text-[10px] md:text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text inline-block transition-colors duration-300", 
                    props.cardTextColor ? "" : (isDark ? "text-slate-600" : "text-slate-400")
                  )}
                  value={props.schoolName || 'School Name'}
                  html={false}
                />
              </div>
            </div>

          </div>

        </div>
      );
    }

    if (props.preset === 'split-video') {
      return (
        <div 
          className={cn(
            "max-w-5xl mx-auto p-6 md:p-8 rounded-3xl text-left flex gap-6 md:gap-8 items-center shadow-xl backdrop-blur-sm relative group/card font-figtree",
            isMobileOrTablet ? "flex-col-reverse" : "flex-col-reverse md:flex-row",
            isCustomBg ? "" : (isDark ? "bg-slate-950" : "bg-white"),
            props.cardBorderColor ? "" : (isDark ? "border border-slate-850" : "border border-slate-200/60")
          )}
          style={getCardStyle(props)}
        >
          {/* Left-hand side: Content Column */}
          <div className="flex-1 flex flex-col justify-between self-stretch py-1">
            {/* Header: School Logo, School Name, and Subtitle */}
            <div className="flex items-center gap-3">
              {/* School Logo */}
              <div className="relative group/logo cursor-pointer shrink-0">
                {props.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={props.logoUrl} alt="School Logo" className={cn("w-10 h-10 rounded-full object-cover shadow-sm border", isDark ? "border-slate-800" : "border-slate-200")} />
                ) : (
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border", isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-100 text-slate-500 border-slate-200")}>
                    LOGO
                  </div>
                )}
                {ctx.mode === 'edit' && ctx.page?.workspaceId && (
                  <>
                    <div
                      onClick={(e) => { e.stopPropagation(); setLogoLibraryOpen(true); }}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover/logo:opacity-100 transition-opacity z-10"
                    >
                      <span className="text-[8px] font-bold text-white uppercase tracking-wider scale-90">Change</span>
                    </div>
                    <MediaSelectorDialog
                      open={logoLibraryOpen}
                      onOpenChange={setLogoLibraryOpen}
                      onSelectAsset={(asset) => {
                        ctx.onPropChange?.({ logoUrl: asset.url });
                        setLogoLibraryOpen(false);
                      }}
                      filterType="image"
                      workspaceId={ctx.page.workspaceId}
                    />
                  </>
                )}
              </div>

              <div className="space-y-0.5 text-left">
                <InlineEditable
                  tagName="p"
                  isEdit={ctx.mode === 'edit'}
                  data-block-id={_block.id}
                  data-prop-key="schoolName"
                  data-rich="false"
                  onChange={(val) => ctx.onPropChange?.({ schoolName: val })}
                  className={cn("text-lg font-extrabold outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text block", props.cardTextColor ? "" : (isDark ? "text-white" : "text-slate-900"))}
                  value={props.schoolName || 'Sunflower School'}
                  html={false}
                />
                <InlineEditable
                  tagName="p"
                  isEdit={ctx.mode === 'edit'}
                  data-block-id={_block.id}
                  data-prop-key="schoolSubtitle"
                  data-rich="false"
                  onChange={(val) => ctx.onPropChange?.({ schoolSubtitle: val })}
                  className={cn("text-xs outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text mt-0.5 block", props.cardTextColor ? "" : (isDark ? "text-slate-400" : "text-slate-500"))}
                  value={props.schoolSubtitle || 'Ghana'}
                  html={false}
                />
              </div>
            </div>

            {/* Testimonial Quote Statement */}
            <div className="my-6">
              <InlineEditable
                tagName="blockquote"
                isEdit={ctx.mode === 'edit'}
                data-block-id={_block.id}
                data-prop-key="quote"
                data-rich="true"
                onChange={(val) => ctx.onPropChange?.({ quote: val })}
                className={cn("text-base font-normal leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1", props.cardTextColor ? "" : (isDark ? "text-slate-200" : "text-slate-800"))}
                value={ctx.mode === 'edit' ? props.quote : ctx.interpolate(props.quote)}
                html={true}
              />
            </div>

            {/* Quote Author */}
            <div className={cn("flex items-center gap-1.5 text-xs font-medium", props.cardTextColor ? "" : (isDark ? "text-slate-400" : "text-slate-500"))}>
              <span>-</span>
              <InlineEditable
                tagName="span"
                isEdit={ctx.mode === 'edit'}
                data-block-id={_block.id}
                data-prop-key="author"
                data-rich="false"
                onChange={(val) => ctx.onPropChange?.({ author: val })}
                className={cn("font-bold outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text", props.cardTextColor ? "" : (isDark ? "text-slate-300" : "text-slate-700"))}
                value={props.author || 'Author'}
                html={false}
              />
              <span>,</span>
              <InlineEditable
                tagName="span"
                isEdit={ctx.mode === 'edit'}
                data-block-id={_block.id}
                data-prop-key="role"
                data-rich="false"
                onChange={(val) => ctx.onPropChange?.({ role: val })}
                className="outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text"
                value={props.role || 'Role'}
                html={false}
              />
            </div>
          </div>

          {/* Right-hand side: Video visual */}
          <div className="flex-1 w-full md:max-w-md shrink-0">
            {hasVideo ? (
              playInline ? (
                <div className={cn("relative aspect-video w-full rounded-2xl overflow-hidden border group", isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-slate-100")}>
                  <VideoEmbed
                    url={finalVideoUrl}
                    thumbnailUrl={finalThumbnailUrl || undefined}
                    disabled={ctx.mode === 'edit' || ctx.isThumbnail}
                  />
                  {changeControls}
                </div>
              ) : (
                <>
                  <div
                    onClick={() => setModalOpen(true)}
                    className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 cursor-pointer group shadow-sm transition-all"
                  >
                    {finalThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={finalThumbnailUrl}
                        alt="Testimonial thumbnail preview"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400">
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Watch Video Testimonial</span>
                      </div>
                    )}

                    {/* Tap To Watch Play button overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15 group-hover:bg-black/25 transition-colors duration-300">
                      <span className="text-[10px] font-black tracking-widest text-white uppercase mb-2 drop-shadow-md opacity-90">Tap To Watch Video</span>
                      <div className="relative flex items-center justify-center">
                        {/* Pulsing blue outer ring */}
                        <div className="absolute -inset-2.5 rounded-full bg-blue-500/40 animate-pulse scale-105" />
                        <div className="absolute -inset-1 rounded-full bg-blue-500/25 animate-ping opacity-75" />
                        {/* Solid play button */}
                        <div className="relative w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/35 transform transition-transform duration-300 group-hover:scale-110 active:scale-95">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    {changeControls}
                  </div>

                  <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent className="max-w-3xl aspect-video p-0 overflow-hidden bg-black border border-slate-800 rounded-2xl">
                      <DialogTitle className="sr-only">Video Testimonial Player</DialogTitle>
                      <iframe
                        src={finalVideoUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Video Testimonial"
                      />
                    </DialogContent>
                  </Dialog>
                </>
              )
            ) : (
              <div className="aspect-video w-full rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                <Quote className="w-8 h-8 opacity-45 text-emerald-500" />
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <figure 
        className={cn(
          "max-w-lg mx-auto p-6 rounded-2xl text-center space-y-4 shadow-xl backdrop-blur-sm relative group/card font-figtree",
          isCustomBg ? "" : (isDark ? "bg-slate-950/40" : "bg-slate-50/70"),
          props.cardBorderColor ? "" : (isDark ? "border border-slate-850" : "border border-slate-200/60")
        )}
        style={getCardStyle(props)}
      >
        {hasVideo ? (
          playInline ? (
            <div className={cn("relative aspect-video w-full rounded-xl overflow-hidden mb-4 group border", isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-slate-100")}>
              <VideoEmbed
                url={finalVideoUrl}
                thumbnailUrl={finalThumbnailUrl || undefined}
                disabled={ctx.mode === 'edit' || ctx.isThumbnail}
              />
              {changeControls}
            </div>
          ) : (
            <>
              <div 
                onClick={() => setModalOpen(true)}
                className={cn("relative aspect-video w-full rounded-xl overflow-hidden mb-4 cursor-pointer group shadow-sm transition-all border", isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-slate-100")}
              >
                {finalThumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={finalThumbnailUrl} 
                    alt="Testimonial thumbnail preview" 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                ) : (
                  <div className={cn("absolute inset-0 flex flex-col items-center justify-center", isDark ? "bg-slate-900/50 text-slate-400" : "bg-slate-200/50 text-slate-500")}>
                    <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Watch Video Testimonial</span>
                  </div>
                )}
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors duration-300">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transform transition-transform duration-300 group-hover:scale-110 active:scale-95">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
                {changeControls}
              </div>
              
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-3xl aspect-video p-0 overflow-hidden bg-black border border-slate-800 rounded-2xl">
                  <DialogTitle className="sr-only">Video Testimonial Player</DialogTitle>
                  <iframe
                    src={finalVideoUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video Testimonial"
                  />
                </DialogContent>
              </Dialog>
            </>
          )
        ) : (
          <Quote className="w-8 h-8 mx-auto opacity-45 text-emerald-500" />
        )}
        
        <InlineEditable
          tagName="blockquote"
          isEdit={ctx.mode === 'edit'}
          data-block-id={_block.id}
          data-prop-key="quote"
          data-rich="true"
          onChange={(val) => ctx.onPropChange?.({ quote: val })}
          className={cn("text-sm italic leading-relaxed font-normal outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 min-w-[20px]", props.cardTextColor ? "" : (isDark ? "text-slate-200" : "text-slate-800"))}
          value={ctx.mode === 'edit' ? props.quote : ctx.interpolate(props.quote)}
          html={true}
        />
        
        <figcaption className={cn("flex items-center justify-center gap-3 pt-2 border-t", isDark ? "border-slate-850/50" : "border-slate-200")}>
          <div className="relative group/avatar cursor-pointer">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.avatarUrl} alt={props.author} width={36} height={36} className={cn("w-9 h-9 rounded-full object-cover shadow-sm border", isDark ? "border-slate-800" : "border-slate-200")} />
            ) : (
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold", isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-700")}>
                {props.author ? props.author.slice(0, 2).toUpperCase() : 'AN'}
              </div>
            )}
            {ctx.mode === 'edit' && ctx.page?.workspaceId && (
              <>
                <div 
                  onClick={(e) => { e.stopPropagation(); setAvatarLibraryOpen(true); }}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity z-10"
                >
                  <span className="text-[8px] font-bold text-white uppercase tracking-wider scale-90">Change</span>
                </div>
                <MediaSelectorDialog
                  open={avatarLibraryOpen}
                  onOpenChange={setAvatarLibraryOpen}
                  onSelectAsset={(asset) => {
                    ctx.onPropChange?.({ avatarUrl: asset.url });
                    setAvatarLibraryOpen(false);
                  }}
                  filterType="image"
                  workspaceId={ctx.page.workspaceId}
                />
              </>
            )}
          </div>
          <div className="text-left leading-tight">
            <InlineEditable
              tagName="p"
              isEdit={ctx.mode === 'edit'}
              data-block-id={_block.id}
              data-prop-key="author"
              data-rich="false"
              onChange={(val) => ctx.onPropChange?.({ author: val })}
              className={cn("text-xs font-black outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] inline-block cursor-text", props.cardTextColor ? "" : (isDark ? "text-slate-100" : "text-slate-900"))}
              value={props.author || 'Author Name'}
              html={false}
            />
            {(ctx.mode === 'edit' || props.role) && (
              <InlineEditable
                tagName="p"
                isEdit={ctx.mode === 'edit'}
                data-block-id={_block.id}
                data-prop-key="role"
                data-rich="false"
                onChange={(val) => ctx.onPropChange?.({ role: val })}
                className={cn("text-[10px] font-semibold outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] block cursor-text mt-0.5", props.cardTextColor ? "" : (isDark ? "text-slate-400" : "text-slate-500"))}
                value={ctx.mode === 'edit' ? (props.role || 'Role / Company') : props.role}
                html={false}
              />
            )}
          </div>
        </figcaption>
      </figure>
    );
  },
});
