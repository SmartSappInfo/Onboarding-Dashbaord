import React, { useState, useEffect } from 'react';
import { RefreshCw, FolderHeart, Trash2, Link as LinkIcon, Upload, ArrowLeft, Play, FileVideo, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface UploadedStateProps {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  fileName?: string;
  fileSize?: string;
  showGallery: boolean;
  onTriggerReplaceVideo: () => void;
  onTriggerReplaceThumbnail: () => void;
  onTriggerGalleryVideo: () => void;
  onTriggerGalleryThumbnail: () => void;
  onOpenLinkVideo: () => void;
  onOpenLinkThumbnail: () => void;
  onRemoveVideo: () => void;
  onRemoveThumbnail: () => void;
  onMetadataChange: (meta: { title: string; description: string }) => void;
  onOpenAiDesigner?: () => void;
}

export function UploadedState({
  videoUrl,
  thumbnailUrl,
  title,
  description,
  fileName,
  fileSize,
  showGallery,
  onTriggerReplaceVideo,
  onTriggerReplaceThumbnail,
  onTriggerGalleryVideo,
  onTriggerGalleryThumbnail,
  onOpenLinkVideo,
  onOpenLinkThumbnail,
  onRemoveVideo,
  onRemoveThumbnail,
  onMetadataChange,
  onOpenAiDesigner
}: UploadedStateProps) {
  const [isChangingVideo, setIsChangingVideo] = useState(false);
  const [isChangingThumbnail, setIsChangingThumbnail] = useState(false);
  const [showMetadata, setShowMetadata] = useState(Boolean(title || description));
  
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description);

  // Sync from props if updated externally
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  const handleBlur = () => {
    onMetadataChange({ title: localTitle, description: localDescription });
  };

  const getFilenameFromUrl = (url: string): string => {
    if (fileName) return fileName;
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('?')[0];
    } catch (e) {
      return 'video.mp4';
    }
  };

  const videoName = getFilenameFromUrl(videoUrl);

  return (
    <div className="w-full flex flex-col gap-4 border border-border/80 bg-background/50 rounded-2xl p-4 shadow-sm">
      
      {/* Video Source Control */}
      <div className="space-y-1.5 text-left">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Video Source
        </Label>
        
        {isChangingVideo ? (
          <div className="w-full rounded-xl border border-border bg-background p-4 flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center">
              Select video source…
            </p>
            <div className="flex flex-col gap-2 w-full">
              <Button
                type="button"
                size="sm"
                onClick={() => { onTriggerReplaceVideo(); setIsChangingVideo(false); }}
                className="w-full h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </Button>
              {showGallery && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onTriggerGalleryVideo(); setIsChangingVideo(false); }}
                  className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                >
                  <FolderHeart className="w-3.5 h-3.5" /> Media Gallery
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onOpenLinkVideo(); setIsChangingVideo(false); }}
                className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Paste Video Link
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingVideo(false)}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mt-1"
            >
              <ArrowLeft className="w-3 h-3" /> Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border border-border/60 bg-muted/10 rounded-xl p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative aspect-video w-16 bg-slate-900 border border-slate-800 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                ) : (
                  <FileVideo className="w-6 h-6 text-slate-500" />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white/80 fill-current" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate max-w-[130px]" title={videoName}>
                  {videoName}
                </div>
                {fileSize && (
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {fileSize}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsChangingVideo(true)}
                className="w-8 h-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                title="Change Video"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemoveVideo}
                className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-600"
                title="Remove Video"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Cover Image Section */}
      <div className="space-y-1.5 text-left">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Thumbnail Cover Image
        </Label>
        
        {isChangingThumbnail ? (
          <div className="flex flex-col gap-2.5 border border-border/80 bg-background rounded-xl p-3 animate-in fade-in duration-200">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              Choose Cover Option:
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <Button
                type="button"
                size="sm"
                onClick={() => { onTriggerReplaceThumbnail(); setIsChangingThumbnail(false); }}
                className="w-full h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white active:scale-[0.97] flex items-center justify-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Cover Image
              </Button>
              {showGallery && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onTriggerGalleryThumbnail(); setIsChangingThumbnail(false); }}
                  className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97] flex items-center justify-center gap-1"
                >
                  <FolderHeart className="w-3.5 h-3.5" /> Media Gallery
                </Button>
              )}
              {onOpenAiDesigner && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onOpenAiDesigner(); setIsChangingThumbnail(false); }}
                  className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97] flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> AI Thumbnail Designer
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onOpenLinkThumbnail(); setIsChangingThumbnail(false); }}
                className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97] flex items-center justify-center gap-1"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Paste Image Link
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingThumbnail(false)}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mt-1"
            >
              <ArrowLeft className="w-3 h-3" /> Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border border-border/60 bg-background rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-10 bg-slate-900 border border-border rounded overflow-hidden shrink-0">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="Cover preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none text-center">
                    Auto
                  </div>
                )}
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">Cover Image</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsChangingThumbnail(true)}
                className="w-8 h-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                title="Change Thumbnail"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              {thumbnailUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveThumbnail}
                  className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-600"
                  title="Clear custom thumbnail"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Option: Title and Description Accordion */}
      <div className="border-t border-border/60 pt-4 mt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 text-left">
            <Label htmlFor="metadata-toggle" className="text-xs font-bold text-foreground cursor-pointer">
              Add Title & Description (Optional)
            </Label>
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">
              Display overlay headings on landing page or surveys
            </p>
          </div>
          <Switch
            id="metadata-toggle"
            checked={showMetadata}
            onCheckedChange={(checked) => {
              setShowMetadata(checked);
              if (!checked) {
                setLocalTitle('');
                setLocalDescription('');
                onMetadataChange({ title: '', description: '' });
              }
            }}
          />
        </div>

        {showMetadata && (
          <div className="space-y-3 mt-4 animate-in slide-in-from-top-3 duration-200 ease-out text-left">
            <div className="space-y-1">
              <Label htmlFor="video-meta-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Video Title
              </Label>
              <Input
                id="video-meta-title"
                type="text"
                placeholder="Enter video title…"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleBlur}
                className="h-10 rounded-xl bg-muted/20 border-input text-xs font-semibold focus-visible:ring-emerald-500/30"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="video-meta-desc" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Video Description
              </Label>
              <Textarea
                id="video-meta-desc"
                placeholder="Enter video description…"
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={handleBlur}
                className="min-h-[80px] rounded-xl bg-muted/20 border-input text-xs font-semibold p-3 focus-visible:ring-emerald-500/30"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
