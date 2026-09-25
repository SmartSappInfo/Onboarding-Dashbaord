import React, { useState, useEffect } from 'react';
import { RefreshCw, FolderHeart, Trash2, Link as LinkIcon, Upload, ArrowLeft, Play, FileVideo, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type VideoTitlePosition = 'top' | 'bottom' | 'overlay';

interface UploadedStateProps {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  titlePosition?: VideoTitlePosition;
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
  onMetadataChange: (meta: { title: string; description: string; titlePosition?: VideoTitlePosition }) => void;
  onOpenAiDesigner?: () => void;
}

const POSITION_OPTIONS: Array<{
  id: VideoTitlePosition;
  label: string;
  desc: string;
  wireframe: React.ReactNode;
}> = [
  {
    id: 'top',
    label: 'Top',
    desc: 'Above video',
    wireframe: (
      <div className="w-full aspect-[16/10] rounded-[4px] bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs">
        {/* Title & description bars ABOVE video */}
        <div className="flex flex-col gap-0.5 w-full">
          <div className="w-3/5 h-1.5 rounded-[2px] bg-emerald-500" />
          <div className="w-2/5 h-0.5 rounded-[1.5px] bg-slate-400/80 dark:bg-slate-500" />
        </div>
        {/* Video Player Box with small round corner */}
        <div className="w-full flex-1 mt-1 rounded-[3px] bg-slate-200/90 dark:bg-slate-700/90 border border-slate-300 dark:border-slate-600 flex flex-col justify-between p-0.5 shadow-2xs relative overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-0 h-0 border-y-[2.5px] border-y-transparent border-l-[4.5px] border-l-slate-700 dark:border-l-slate-300 ml-0.5" />
          </div>
          <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600 rounded-[1px] flex items-center relative">
            <div className="w-1/4 h-full bg-slate-700 dark:bg-slate-300 rounded-[1px]" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'overlay',
    label: 'Overlay',
    desc: 'On thumbnail',
    wireframe: (
      <div className="w-full aspect-[16/10] rounded-[4px] bg-slate-800 dark:bg-slate-950 border border-slate-700/80 flex flex-col justify-between overflow-hidden shadow-2xs relative">
        {/* Video player play icon */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white/90 ml-0.5" />
        </div>
        {/* Gradient overlay at bottom of thumbnail with text */}
        <div className="relative w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1 pt-1.5 flex flex-col gap-0.5">
          <div className="w-3/5 h-1.5 rounded-[2px] bg-white/95" />
          <div className="w-2/5 h-0.5 rounded-[1.5px] bg-white/60" />
        </div>
      </div>
    ),
  },
  {
    id: 'bottom',
    label: 'Bottom',
    desc: 'Below video',
    wireframe: (
      <div className="w-full aspect-[16/10] rounded-[4px] bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs">
        {/* Video Player Box with small round corner */}
        <div className="w-full flex-1 mb-1 rounded-[3px] bg-slate-200/90 dark:bg-slate-700/90 border border-slate-300 dark:border-slate-600 flex flex-col justify-between p-0.5 shadow-2xs relative overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-0 h-0 border-y-[2.5px] border-y-transparent border-l-[4.5px] border-l-slate-700 dark:border-l-slate-300 ml-0.5" />
          </div>
          <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600 rounded-[1px] flex items-center relative">
            <div className="w-1/4 h-full bg-slate-700 dark:bg-slate-300 rounded-[1px]" />
          </div>
        </div>
        {/* Title & description bars BELOW video */}
        <div className="flex flex-col gap-0.5 w-full">
          <div className="w-3/5 h-1.5 rounded-[2px] bg-emerald-500" />
          <div className="w-2/5 h-0.5 rounded-[1.5px] bg-slate-400/80 dark:bg-slate-500" />
        </div>
      </div>
    ),
  },
];

export function UploadedState({
  videoUrl,
  thumbnailUrl,
  title,
  description,
  titlePosition = 'overlay',
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
  const [localTitlePosition, setLocalTitlePosition] = useState<VideoTitlePosition>(titlePosition || 'overlay');

  // Sync from props if updated externally
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  useEffect(() => {
    if (titlePosition) {
      setLocalTitlePosition(titlePosition);
    }
  }, [titlePosition]);

  // Real-time live synchronization for instant canvas & simulator updates
  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    onMetadataChange({
      title: val,
      description: localDescription,
      titlePosition: localTitlePosition,
    });
  };

  const handleDescriptionChange = (val: string) => {
    setLocalDescription(val);
    onMetadataChange({
      title: localTitle,
      description: val,
      titlePosition: localTitlePosition,
    });
  };

  const handlePositionChange = (pos: VideoTitlePosition) => {
    setLocalTitlePosition(pos);
    onMetadataChange({
      title: localTitle,
      description: localDescription,
      titlePosition: pos,
    });
  };

  const handleBlur = () => {
    onMetadataChange({
      title: localTitle,
      description: localDescription,
      titlePosition: localTitlePosition,
    });
  };

  const getFilenameFromUrl = (url: string): string => {
    if (fileName) return fileName;
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('?')[0];
    } catch {
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
                <Upload className="w-3.5 h-3.5" /> Upload
              </Button>
              {showGallery && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onTriggerGalleryVideo(); setIsChangingVideo(false); }}
                  className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                >
                  <FolderHeart className="w-3.5 h-3.5" /> Library
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onOpenLinkVideo(); setIsChangingVideo(false); }}
                className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Link
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
                <Upload className="w-3.5 h-3.5" /> Upload
              </Button>
              {showGallery && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onTriggerGalleryThumbnail(); setIsChangingThumbnail(false); }}
                  className="w-full h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97] flex items-center justify-center gap-1"
                >
                  <FolderHeart className="w-3.5 h-3.5" /> Library
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
                <LinkIcon className="w-3.5 h-3.5" /> Link
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
              Display title and description across top, bottom, or thumbnail overlay
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
                onMetadataChange({ 
                  title: '', 
                  description: '', 
                  titlePosition: localTitlePosition 
                });
              }
            }}
          />
        </div>

        {showMetadata && (
          <div className="space-y-3.5 mt-4 animate-in slide-in-from-top-3 duration-200 ease-out text-left">
            <div className="space-y-1">
              <Label htmlFor="video-meta-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Video Title
              </Label>
              <Input
                id="video-meta-title"
                type="text"
                placeholder="Enter video title…"
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
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
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={handleBlur}
                className="min-h-[80px] rounded-xl bg-muted/20 border-input text-xs font-semibold p-3 focus-visible:ring-emerald-500/30"
              />
            </div>

            {/* Title & Description Position Selector */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Title & Description Position
              </Label>
              <div 
                role="radiogroup" 
                aria-label="Title and description position"
                className="grid grid-cols-3 gap-2"
              >
                {POSITION_OPTIONS.map((option, idx) => {
                  const isSelected = localTitlePosition === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => handlePositionChange(option.id)}
                      onKeyDown={(e) => {
                        let nextIdx = idx;
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handlePositionChange(option.id);
                          return;
                        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          nextIdx = (idx + 1) % POSITION_OPTIONS.length;
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          nextIdx = (idx - 1 + POSITION_OPTIONS.length) % POSITION_OPTIONS.length;
                        } else {
                          return;
                        }

                        handlePositionChange(POSITION_OPTIONS[nextIdx].id);
                        const container = e.currentTarget.closest('[role="radiogroup"]');
                        const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                        buttons?.[nextIdx]?.focus();
                      }}
                      className={cn(
                        "relative flex flex-col p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[44px]",
                        "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                        isSelected
                          ? "border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 shadow-xs"
                          : "border border-border/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {/* Mini Wireframe */}
                      {option.wireframe}

                      {/* Title & Check Icon */}
                      <div className="flex items-center justify-between gap-1 w-full mt-1">
                        <span className={cn(
                          "text-xs font-bold leading-tight truncate",
                          isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                        )}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground font-medium leading-tight mt-0.5">
                        {option.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
