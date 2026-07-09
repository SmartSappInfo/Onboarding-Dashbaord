'use client';

import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Quote, Play, Edit } from 'lucide-react';
import { registerBlock } from '../registry';
import { sanitizeHtml } from '../sanitize';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

const schema = z.object({
  quote: z.string().default(''),
  author: z.string().default(''),
  role: z.string().default(''),
  avatarUrl: z.string().default(''),
  videoUrl: z.string().default(''),
  thumbnailUrl: z.string().default(''),
  playMode: z.enum(['inline', 'modal']).default('inline'),
  // New fields for the split-video layout
  preset: z.enum(['standard', 'split-video', 'horizontal-dark']).default('standard'),
  schoolName: z.string().default(''),
  schoolSubtitle: z.string().default(''),
  logoUrl: z.string().default(''),
  videoCaption: z.string().default(''),
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
    { kind: 'url', key: 'videoUrl', label: 'Video Visual Link', filterType: 'video' },
    { kind: 'image', key: 'thumbnailUrl', label: 'Video Thumbnail Image' },
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
    const hasVideo = props.videoUrl;
    const playInline = props.playMode === 'inline';
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
    const quoteRef = useRef<HTMLQuoteElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const authorRef = useRef<HTMLParagraphElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const roleRef = useRef<HTMLParagraphElement>(null);

    // New refs for Sunflower layout
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const schoolNameRef = useRef<HTMLParagraphElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const schoolSubtitleRef = useRef<HTMLParagraphElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const videoCaptionRef = useRef<HTMLParagraphElement>(null);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastQuoteRef = useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastAuthorRef = useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastRoleRef = useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastSchoolNameRef = useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastSchoolSubtitleRef = useRef<string>('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const lastVideoCaptionRef = useRef<string>('');

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [hasMounted, setHasMounted] = useState(false);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setHasMounted(true);
    }, []);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (hasMounted) {
        if (quoteRef.current) {
          const expected = ctx.mode === 'edit' ? props.quote : sanitizeHtml(ctx.interpolate(props.quote));
          if (expected !== quoteRef.current.innerHTML) {
            quoteRef.current.innerHTML = expected;
          }
          lastQuoteRef.current = props.quote;
        }
        if (authorRef.current) {
          const expected = props.author || '';
          if (expected !== authorRef.current.innerText) {
            authorRef.current.innerText = expected;
          }
          lastAuthorRef.current = expected;
        }
        if (roleRef.current) {
          const expected = props.role || '';
          if (expected !== roleRef.current.innerText) {
            roleRef.current.innerText = expected;
          }
          lastRoleRef.current = expected;
        }
        if (schoolNameRef.current) {
          const expected = props.schoolName || '';
          if (expected !== schoolNameRef.current.innerText) {
            schoolNameRef.current.innerText = expected;
          }
          lastSchoolNameRef.current = expected;
        }
        if (schoolSubtitleRef.current) {
          const expected = props.schoolSubtitle || '';
          if (expected !== schoolSubtitleRef.current.innerText) {
            schoolSubtitleRef.current.innerText = expected;
          }
          lastSchoolSubtitleRef.current = expected;
        }
        if (videoCaptionRef.current) {
          const expected = props.videoCaption || '';
          if (expected !== videoCaptionRef.current.innerText) {
            videoCaptionRef.current.innerText = expected;
          }
          lastVideoCaptionRef.current = expected;
        }
      }
    }, [props.quote, props.author, props.role, props.schoolName, props.schoolSubtitle, props.videoCaption, ctx.mode, hasMounted, ctx]);

    const changeControls = ctx.mode === 'edit' && ctx.page?.workspaceId && (
      <>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 p-1 rounded-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVideoLibraryOpen(true); }}
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
        <MediaSelectorDialog
          open={videoLibraryOpen}
          onOpenChange={setVideoLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({ videoUrl: asset.url });
            setVideoLibraryOpen(false);
          }}
          filterType="video"
          workspaceId={ctx.page.workspaceId}
        />
        <MediaSelectorDialog
          open={thumbnailLibraryOpen}
          onOpenChange={setThumbnailLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({ thumbnailUrl: asset.url });
            setThumbnailLibraryOpen(false);
          }}
          filterType="image"
          workspaceId={ctx.page.workspaceId}
        />
      </>
    );

    if (props.preset === 'horizontal-dark') {
      return (
        <div className="max-w-5xl mx-auto p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] dark:from-[#080C14] dark:to-[#0D1321] text-left flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8 shadow-2xl relative border border-slate-800/40 group/card">
          
          {/* Rounded Squircle Avatar/Image on the left */}
          <div className="relative group/avatar cursor-pointer shrink-0">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={props.avatarUrl} 
                alt={props.author} 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] object-cover shadow-lg border border-white/10" 
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-slate-800 border border-slate-700/50 text-slate-400 flex items-center justify-center text-xs font-bold shadow-lg">
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
              <blockquote 
                ref={quoteRef}
                contentEditable={ctx.mode === 'edit'}
                suppressContentEditableWarning
                data-block-id={_block.id}
                data-prop-key="quote"
                data-rich="true"
                onBlur={(e) => {
                  const newHtml = e.currentTarget.innerHTML;
                  lastQuoteRef.current = newHtml;
                  ctx.onPropChange?.({ quote: newHtml });
                }}
                className="text-base md:text-lg font-medium leading-relaxed text-white outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 w-full"
                dangerouslySetInnerHTML={!hasMounted ? { __html: ctx.mode === 'edit' ? props.quote : sanitizeHtml(ctx.interpolate(props.quote)) } : undefined}
              />
            </div>

            {/* Horizontal line divider */}
            <div className="border-t border-white/10 w-full my-4" />

            {/* Author, Role & School Name Info */}
            <div className="text-left space-y-0.5">
              <div className="text-xs md:text-sm text-slate-300 dark:text-slate-400 font-semibold flex items-center gap-1">
                {ctx.mode === 'edit' ? (
                  <>
                    <span 
                      ref={authorRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-block-id={_block.id}
                      data-prop-key="author"
                      data-rich="false"
                      onBlur={(e) => {
                        const text = e.currentTarget.innerText || '';
                        lastAuthorRef.current = text;
                        ctx.onPropChange?.({ author: text });
                      }}
                      className="outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text text-white font-bold"
                    >
                      {!hasMounted ? (props.author || 'Author Name') : undefined}
                    </span>
                    <span>,</span>
                    <span 
                      ref={roleRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-block-id={_block.id}
                      data-prop-key="role"
                      data-rich="false"
                      onBlur={(e) => {
                        const text = e.currentTarget.innerText || '';
                        lastRoleRef.current = text;
                        ctx.onPropChange?.({ role: text });
                      }}
                      className="outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text font-normal text-slate-350"
                    >
                      {!hasMounted ? (props.role || 'Role') : undefined}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold">{props.author}</span>
                    <span>,</span>
                    <span className="font-normal text-slate-350">{props.role}</span>
                  </>
                )}
              </div>

              {/* School Name */}
              <div>
                {ctx.mode === 'edit' ? (
                  <p 
                    ref={schoolNameRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-block-id={_block.id}
                    data-prop-key="schoolName"
                    data-rich="false"
                    onBlur={(e) => {
                      const text = e.currentTarget.innerText || '';
                      lastSchoolNameRef.current = text;
                      ctx.onPropChange?.({ schoolName: text });
                    }}
                    className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-medium outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text inline-block"
                  >
                    {!hasMounted ? (props.schoolName || 'School Name') : undefined}
                  </p>
                ) : (
                  <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-medium">{props.schoolName}</p>
                )}
              </div>
            </div>

          </div>

        </div>
      );
    }

    if (props.preset === 'split-video') {
      const videoCaptionText = props.videoCaption || 'How Sunflower School cleared their debtors lists without stress';
      return (
        <div className="max-w-5xl mx-auto p-6 md:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-950 text-left flex flex-col md:flex-row gap-6 md:gap-8 items-center shadow-xl backdrop-blur-sm relative group/card">
          {/* Left-hand side: Content Column */}
          <div className="flex-1 flex flex-col justify-between self-stretch py-1">
            {/* Header: School Name, Subtitle, and Logo */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                {ctx.mode === 'edit' ? (
                  <>
                    <p
                      ref={schoolNameRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-block-id={_block.id}
                      data-prop-key="schoolName"
                      data-rich="false"
                      onBlur={(e) => {
                        const text = e.currentTarget.innerText || '';
                        lastSchoolNameRef.current = text;
                        ctx.onPropChange?.({ schoolName: text });
                      }}
                      className="text-lg font-extrabold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text"
                    >
                      {!hasMounted ? (props.schoolName || 'Sunflower School') : undefined}
                    </p>
                    <p
                      ref={schoolSubtitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-block-id={_block.id}
                      data-prop-key="schoolSubtitle"
                      data-rich="false"
                      onBlur={(e) => {
                        const text = e.currentTarget.innerText || '';
                        lastSchoolSubtitleRef.current = text;
                        ctx.onPropChange?.({ schoolSubtitle: text });
                      }}
                      className="text-xs text-slate-500 dark:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text mt-0.5"
                    >
                      {!hasMounted ? (props.schoolSubtitle || 'Ghana') : undefined}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{props.schoolName || 'Sunflower School'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{props.schoolSubtitle || 'Ghana'}</p>
                  </>
                )}
              </div>

              {/* School Logo */}
              <div className="relative group/logo cursor-pointer shrink-0">
                {props.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={props.logoUrl} alt="School Logo" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-450 flex items-center justify-center text-xs font-bold border border-slate-200 dark:border-slate-700">
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
            </div>

            {/* Testimonial Quote Statement */}
            <div className="my-6">
              <blockquote
                ref={quoteRef}
                contentEditable={ctx.mode === 'edit'}
                suppressContentEditableWarning
                data-block-id={_block.id}
                data-prop-key="quote"
                data-rich="true"
                onBlur={(e) => {
                  const newHtml = e.currentTarget.innerHTML;
                  lastQuoteRef.current = newHtml;
                  ctx.onPropChange?.({ quote: newHtml });
                }}
                className="text-base font-semibold leading-relaxed text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1"
                dangerouslySetInnerHTML={!hasMounted ? { __html: ctx.mode === 'edit' ? props.quote : sanitizeHtml(ctx.interpolate(props.quote)) } : undefined}
              />
            </div>

            {/* Quote Author */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>-</span>
              {ctx.mode === 'edit' ? (
                <>
                  <span
                    ref={authorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-block-id={_block.id}
                    data-prop-key="author"
                    data-rich="false"
                    onBlur={(e) => {
                      const text = e.currentTarget.innerText || '';
                      lastAuthorRef.current = text;
                      ctx.onPropChange?.({ author: text });
                    }}
                    className="font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text"
                  >
                    {!hasMounted ? (props.author || 'Author') : undefined}
                  </span>
                  <span>,</span>
                  <span
                    ref={roleRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-block-id={_block.id}
                    data-prop-key="role"
                    data-rich="false"
                    onBlur={(e) => {
                      const text = e.currentTarget.innerText || '';
                      lastRoleRef.current = text;
                      ctx.onPropChange?.({ role: text });
                    }}
                    className="outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 cursor-text"
                  >
                    {!hasMounted ? (props.role || 'Role') : undefined}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{props.author}</span>
                  <span>,</span>
                  <span>{props.role}</span>
                </>
              )}
            </div>
          </div>

          {/* Right-hand side: Video visual */}
          <div className="flex-1 w-full md:max-w-md shrink-0">
            {hasVideo ? (
              playInline ? (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 group">
                  <iframe
                    src={props.videoUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`Testimonial video visual`}
                  />
                  {changeControls}
                </div>
              ) : (
                <>
                  <div
                    onClick={() => setModalOpen(true)}
                    className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 cursor-pointer group shadow-sm transition-all"
                  >
                    {props.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={props.thumbnailUrl}
                        alt="Testimonial thumbnail preview"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400">
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Watch Video Testimonial</span>
                      </div>
                    )}

                    {/* Watermark Logo on cover */}
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 text-white/95 font-bold text-xs select-none pointer-events-none drop-shadow-md">
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">S</div>
                      <span>SmartSapp</span>
                    </div>

                    {/* Tap To Watch Play button overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15 group-hover:bg-black/25 transition-colors duration-300">
                      <span className="text-[10px] font-black tracking-widest text-white uppercase mb-2 drop-shadow-md opacity-90">Tap To Watch Video</span>
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-[#EF5A5A] text-white flex items-center justify-center shadow-lg shadow-red-500/35 transform transition-transform duration-300 group-hover:scale-110 active:scale-95">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                        {/* Hand click cursor overlay */}
                        <div className="absolute -bottom-3 -right-3 z-10 select-none pointer-events-none animate-bounce">
                          <svg viewBox="0 0 24 24" className="w-8 h-8 select-none pointer-events-none" fill="none" stroke="black" strokeWidth="1.5">
                            <path d="M5.5 10v7A5.5 5.5 0 0 0 11 22.5h3.5a5.5 5.5 0 0 0 5.5-5.5v-6.5a2 2 0 0 0-4 0v1.5a1 1 0 0 1-2 0v-4a2 2 0 0 0-4 0v4.5a1 1 0 0 1-2 0V4a2 2 0 0 0-4 0v6" fill="white" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Bottom visual cover caption */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10 text-center select-text">
                      {ctx.mode === 'edit' ? (
                        <p
                          ref={videoCaptionRef}
                          contentEditable
                          suppressContentEditableWarning
                          data-block-id={_block.id}
                          data-prop-key="videoCaption"
                          data-rich="false"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const text = e.currentTarget.innerText || '';
                            lastVideoCaptionRef.current = text;
                            ctx.onPropChange?.({ videoCaption: text });
                          }}
                          className="text-xs font-black text-white outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 inline-block cursor-text"
                        >
                          {!hasMounted ? videoCaptionText : undefined}
                        </p>
                      ) : (
                        <p className="text-xs font-black text-white">
                          {(() => {
                            const raw = videoCaptionText;
                            const parts = raw.split(/(Sunflower School|debtors lists)/gi);
                            return parts.map((part, pI) => {
                              const low = part.toLowerCase();
                              if (low === 'sunflower school' || low === 'debtors lists') {
                                return <span key={pI} className="text-[#FFD369]">{part}</span>;
                              }
                              return part;
                            });
                          })()}
                        </p>
                      )}
                    </div>
                    {changeControls}
                  </div>

                  <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent className="max-w-3xl aspect-video p-0 overflow-hidden bg-black border border-slate-800 rounded-2xl">
                      <DialogTitle className="sr-only">Video Testimonial Player</DialogTitle>
                      <iframe
                        src={props.videoUrl}
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
      <figure className="max-w-lg mx-auto p-6 rounded-2xl border border-slate-200/60 dark:border-slate-850 bg-slate-50/70 dark:bg-slate-950/40 text-center space-y-4 shadow-xl backdrop-blur-sm relative group/card">
        {hasVideo ? (
          playInline ? (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-4 group">
              <iframe
                src={props.videoUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Testimonial video visual`}
              />
              {changeControls}
            </div>
          ) : (
            <>
              <div 
                onClick={() => setModalOpen(true)}
                className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-4 cursor-pointer group shadow-sm transition-all"
              >
                {props.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={props.thumbnailUrl} 
                    alt="Testimonial thumbnail preview" 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
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
                    src={props.videoUrl}
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
        
        <blockquote 
          ref={quoteRef}
          contentEditable={ctx.mode === 'edit'}
          suppressContentEditableWarning
          data-block-id={_block.id}
          data-prop-key="quote"
          data-rich="true"
          onBlur={(e) => {
            const newHtml = e.currentTarget.innerHTML;
            lastQuoteRef.current = newHtml;
            ctx.onPropChange?.({ quote: newHtml });
          }}
          className="text-sm italic leading-relaxed font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 min-w-[20px]"
          dangerouslySetInnerHTML={!hasMounted ? { __html: ctx.mode === 'edit' ? props.quote : sanitizeHtml(ctx.interpolate(props.quote)) } : undefined}
        />
        
        <figcaption className="flex items-center justify-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-850/50">
          <div className="relative group/avatar cursor-pointer">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.avatarUrl} alt={props.author} width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold">
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
            {ctx.mode === 'edit' ? (
              <>
                <p 
                  ref={authorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-block-id={_block.id}
                  data-prop-key="author"
                  data-rich="false"
                  onBlur={(e) => {
                    const text = e.currentTarget.innerText || '';
                    lastAuthorRef.current = text;
                    ctx.onPropChange?.({ author: text });
                  }}
                  className="text-xs font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] inline-block cursor-text"
                >
                  {!hasMounted ? (props.author || 'Author Name') : undefined}
                </p>
                <p 
                  ref={roleRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-block-id={_block.id}
                  data-prop-key="role"
                  data-rich="false"
                  onBlur={(e) => {
                    const text = e.currentTarget.innerText || '';
                    lastRoleRef.current = text;
                    ctx.onPropChange?.({ role: text });
                  }}
                  className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] block cursor-text mt-0.5"
                >
                  {!hasMounted ? (props.role || 'Role / Company') : undefined}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100">{props.author || 'Author Name'}</p>
                {props.role ? <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{props.role}</p> : null}
              </>
            )}
          </div>
        </figcaption>
      </figure>
    );
  },
});
