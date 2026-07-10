'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { Film, Play } from 'lucide-react';
import VideoEmbed from '@/components/video-embed';
import { registerBlock } from '../registry';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

const schema = z.object({
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  videoData: z.object({
    videoUrl: z.string().default(''),
    thumbnailUrl: z.string().default(''),
    title: z.string().default(''),
    description: z.string().default(''),
  }).default({}),
  provider: z.enum(['youtube', 'vimeo', 'loom']).default('youtube'),
  playMode: z.enum(['inline', 'modal']).default('inline'),
});
type VideoProps = z.infer<typeof schema>;

registerBlock({
  type: 'video',
  label: 'Video',
  category: 'content',
  icon: Film,
  fields: [
    { kind: 'video', key: 'videoData', label: 'Video & Cover Settings' },
    {
      kind: 'select',
      key: 'playMode',
      label: 'Playback Mode',
      options: [
        { value: 'inline', label: 'Play Inline' },
        { value: 'modal', label: 'Play in Pop-up Modal' },
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

    const changeControls = ctx.mode === 'edit' && ctx.page?.workspaceId && (
      <>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 p-1 rounded-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVideoLibraryOpen(true); }}
            className="px-2 py-1 text-[9px] font-bold text-white hover:text-emerald-455 transition-colors"
          >
            Change Video
          </button>
        </div>
        <MediaSelectorDialog
          open={videoLibraryOpen}
          onOpenChange={setVideoLibraryOpen}
          onSelectAsset={(asset) => {
            ctx.onPropChange?.({
              videoData: {
                videoUrl: asset.url,
                thumbnailUrl: props.videoData?.thumbnailUrl || '',
                title: props.videoData?.title || '',
                description: props.videoData?.description || '',
              }
            });
            setVideoLibraryOpen(false);
          }}
          filterType="video"
          workspaceId={ctx.page.workspaceId}
        />
      </>
    );

    if (!finalVideoUrl) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <div 
          onClick={() => setVideoLibraryOpen(true)}
          className="h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-850 transition-colors"
        >
          <Film className="w-8 h-8 text-slate-600 animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">Click to select video from media library</span>
          {ctx.page?.workspaceId && (
            <MediaSelectorDialog
              open={videoLibraryOpen}
              onOpenChange={setVideoLibraryOpen}
              onSelectAsset={(asset) => {
                ctx.onPropChange?.({
                  videoData: {
                    videoUrl: asset.url,
                    thumbnailUrl: props.videoData?.thumbnailUrl || '',
                    title: props.videoData?.title || '',
                    description: props.videoData?.description || '',
                  }
                });
                setVideoLibraryOpen(false);
              }}
              filterType="video"
              workspaceId={ctx.page.workspaceId}
            />
          )}
        </div>
      );
    }

    const playInline = props.playMode === 'inline';

    return (
      <div className="group rounded-2xl overflow-hidden border border-black/10 shadow-sm aspect-video bg-black relative">
        {playInline ? (
          <VideoEmbed
            url={finalVideoUrl}
            thumbnailUrl={finalThumbnailUrl || undefined}
            disabled={ctx.mode === 'edit' || ctx.isThumbnail}
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
                  alt="Video thumbnail preview" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Watch Video Tutorial</span>
                </div>
              )}
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transform transition-transform duration-300 group-hover:scale-110 active:scale-95">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>
            
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="max-w-3xl aspect-video p-0 overflow-hidden bg-black border border-slate-800 rounded-2xl">
                <DialogTitle className="sr-only">Video Player</DialogTitle>
                <iframe
                  src={finalVideoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video Block Playback"
                />
              </DialogContent>
            </Dialog>
          </>
        )}
        {changeControls}
      </div>
    );
  },
});
