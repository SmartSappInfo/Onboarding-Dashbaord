'use client';

import React, { useState, useRef } from 'react';
import { z } from 'zod';
import { Film, Play, Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
import VideoEmbed from '@/components/video-embed';
import { registerBlock } from '../registry';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadPageMedia } from '../upload';
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
      </>
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
