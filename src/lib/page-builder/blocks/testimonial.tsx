'use client';

import React from 'react';
import { z } from 'zod';
import { Quote, Play, Edit } from 'lucide-react';
import { registerBlock } from '../registry';
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
  ],
  defaults: schema.parse({}),
  schema,
  variants: [
    { id: 'testi-standard', label: 'Text Quote + Avatar', thumbnail: StandardTestimonialThumbnail, defaults: { videoUrl: '', thumbnailUrl: '', playMode: 'inline' } },
    { id: 'testi-video', label: 'Video Testimonial Card', thumbnail: VideoTestimonialThumbnail, defaults: { videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', playMode: 'inline' } },
  ],
  render: (props: TestimonialProps, _block, ctx) => {
    const hasVideo = props.videoUrl;
    const playInline = props.playMode === 'inline';
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [modalOpen, setModalOpen] = React.useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [avatarLibraryOpen, setAvatarLibraryOpen] = React.useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [videoLibraryOpen, setVideoLibraryOpen] = React.useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [thumbnailLibraryOpen, setThumbnailLibraryOpen] = React.useState(false);

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
          contentEditable={ctx.mode === 'edit'}
          suppressContentEditableWarning
          data-block-id={_block.id}
          data-prop-key="quote"
          data-rich="true"
          onBlur={(e) => ctx.onPropChange?.({ quote: e.currentTarget.innerHTML })}
          className="text-sm italic leading-relaxed font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 min-w-[20px]"
        >
          {ctx.mode === 'edit' ? props.quote : ctx.interpolate(props.quote)}
        </blockquote>
        
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
                  contentEditable
                  suppressContentEditableWarning
                  data-block-id={_block.id}
                  data-prop-key="author"
                  data-rich="false"
                  onBlur={(e) => ctx.onPropChange?.({ author: e.currentTarget.textContent || '' })}
                  className="text-xs font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] inline-block cursor-text"
                >
                  {props.author || 'Author Name'}
                </p>
                <p 
                  contentEditable
                  suppressContentEditableWarning
                  data-block-id={_block.id}
                  data-prop-key="role"
                  data-rich="false"
                  onBlur={(e) => ctx.onPropChange?.({ role: e.currentTarget.textContent || '' })}
                  className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold outline-none focus:ring-1 focus:ring-emerald-500/30 rounded px-0.5 min-w-[20px] block cursor-text mt-0.5"
                >
                  {props.role || 'Role / Company'}
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
