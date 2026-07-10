import React, { useState, useEffect } from 'react';
import { RefreshCw, FolderHeart, Trash2, Link as LinkIcon, Upload, ArrowLeft, Play, FileVideo } from 'lucide-react';
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
  onMetadataChange
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
    <div className="w-full flex flex-col gap-4 border border-border/80 bg-background/50 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Left Side: Drag & Drop Video Uploader / Changer */}
        <div className="flex flex-col gap-3 h-full">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Video Source
          </div>
          {!isChangingVideo ? (
            <div
              onClick={() => setIsChangingVideo(true)}
              className="flex-1 min-h-[160px] rounded-xl border border-dashed border-border hover:border-muted-foreground/35 bg-muted/10 flex flex-col items-center justify-center p-4 gap-3 cursor-pointer group transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-emerald-500 transition-all duration-200">
                <Upload className="w-4.5 h-4.5" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-foreground">Replace Video File</p>
                <p className="text-[10px] font-medium text-muted-foreground">Drag new file or click here</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[160px] rounded-xl border border-border bg-background p-4 flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                Select video source...
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { onTriggerReplaceVideo(); setIsChangingVideo(false); }}
                  className="w-full sm:flex-1 h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </Button>
                {showGallery && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { onTriggerGalleryVideo(); setIsChangingVideo(false); }}
                    className="w-full sm:flex-1 h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                  >
                    <FolderHeart className="w-3.5 h-3.5" /> Media
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onOpenLinkVideo(); setIsChangingVideo(false); }}
                  className="w-full sm:flex-1 h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Paste Link
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setIsChangingVideo(false)}
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mt-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Active Video & Thumbnail Management */}
        <div className="flex flex-col gap-4">
          
          {/* Main Video Display & Metadata */}
          <div className="flex items-start gap-3 border border-border/60 bg-muted/10 rounded-xl p-3">
            <div className="relative aspect-video w-24 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
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
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground truncate" title={videoName}>
                  {videoName}
                </div>
                {fileSize && (
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {fileSize}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsChangingVideo(true)}
                  className="text-[10px] font-black text-emerald-500 hover:text-emerald-600 transition-colors uppercase tracking-wider"
                >
                  Change Video
                </button>
                <span className="text-muted-foreground/30 text-xs">|</span>
                <button
                  type="button"
                  onClick={onRemoveVideo}
                  className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          {/* Video Thumbnail Selector Card */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Thumbnail Cover Image
            </Label>
            
            {!isChangingThumbnail ? (
              <div className="flex items-center gap-3 border border-border/60 bg-background rounded-xl p-3">
                <div className="relative w-14 h-10 bg-muted border border-border rounded overflow-hidden shrink-0">
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none text-center">
                      Auto
                    </div>
                  )}
                </div>
                
                <div className="flex-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsChangingThumbnail(true)}
                    className="h-8 rounded-lg text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97] transition-all"
                  >
                    Change Thumbnail
                  </Button>
                  
                  {thumbnailUrl && (
                    <button
                      type="button"
                      onClick={onRemoveThumbnail}
                      title="Clear custom thumbnail"
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg active:scale-95 transition-all outline-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 border border-border/80 bg-background rounded-xl p-3 animate-in fade-in duration-200">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Choose Cover Option:
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { onTriggerReplaceThumbnail(); setIsChangingThumbnail(false); }}
                    className="flex-1 h-7 rounded-lg text-[9px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white active:scale-[0.97]"
                  >
                    <Upload className="w-3 h-3 mr-1" /> Upload
                  </Button>
                  {showGallery && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { onTriggerGalleryThumbnail(); setIsChangingThumbnail(false); }}
                      className="flex-1 h-7 rounded-lg text-[9px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97]"
                    >
                      <FolderHeart className="w-3 h-3 mr-1" /> Media
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { onOpenLinkThumbnail(); setIsChangingThumbnail(false); }}
                    className="flex-1 h-7 rounded-lg text-[9px] font-bold bg-background border-border text-foreground hover:bg-accent active:scale-[0.97]"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" /> Link
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingThumbnail(false)}
                  className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mt-0.5"
                >
                  <ArrowLeft className="w-2.5 h-2.5" /> Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Option: Title and Description Accordion */}
      <div className="border-t border-border/60 pt-4 mt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="metadata-toggle" className="text-xs font-bold text-foreground cursor-pointer">
              Add Title & Description (Optional)
            </Label>
            <p className="text-[10px] text-muted-foreground font-medium">
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
          <div className="space-y-3 mt-4 animate-in slide-in-from-top-3 duration-200 ease-out">
            <div className="space-y-1">
              <Label htmlFor="video-meta-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Video Title
              </Label>
              <Input
                id="video-meta-title"
                type="text"
                placeholder="Enter video title..."
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
                placeholder="Enter video description..."
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
