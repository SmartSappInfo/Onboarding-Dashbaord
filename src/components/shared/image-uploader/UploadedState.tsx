import React, { useState, useEffect } from 'react';
import { RefreshCw, FolderHeart, Trash2, Maximize2, Link as LinkIcon, Upload, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UploadedStateProps {
  imageUrl: string;
  showGallery: boolean;
  onTriggerReplace: () => void;
  onTriggerGallery: () => void;
  onOpenLink: () => void;
  onRemove: () => void;
}

export function UploadedState({ imageUrl, showGallery, onTriggerReplace, onTriggerGallery, onOpenLink, onRemove }: UploadedStateProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [metadata, setMetadata] = useState<{ size?: string; dimensions?: string }>({});

  const getFilenameFromUrl = (url: string): string => {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('?')[0];
    } catch (e) {
      return 'image.png';
    }
  };

  useEffect(() => {
    if (!previewOpen) return;

    const getMetadata = async () => {
      try {
        const img = new Image();
        img.onload = () => {
          setMetadata(prev => ({
            ...prev,
            dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`
          }));
        };
        img.src = imageUrl;

        const res = await fetch(imageUrl, { method: 'HEAD' });
        const bytes = res.headers.get('content-length');
        if (bytes) {
          const kb = parseInt(bytes, 10) / 1024;
          setMetadata(prev => ({
            ...prev,
            size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`
          }));
        } else {
          const getRes = await fetch(imageUrl);
          const blob = await getRes.blob();
          const kb = blob.size / 1024;
          setMetadata(prev => ({
            ...prev,
            size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`
          }));
        }
      } catch (err) {
        // Silent fallback
      }
    };

    void getMetadata();
  }, [previewOpen, imageUrl]);

  return (
    <div className="w-full">
      <div 
        className="relative h-[220px] rounded-2xl overflow-hidden border border-border bg-muted flex items-center justify-center group cursor-pointer"
        onClick={() => {
          if (!isChanging) setPreviewOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Uploaded asset" className="w-full h-full object-cover" />
        
        {/* 1. Main Action Overlay (Change, Preview, Delete) */}
        {!isChanging ? (
          <div className="absolute inset-0 bg-black/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsChanging(true); }}
              title="Change Image"
              className="w-10 h-10 rounded-full bg-background/90 border border-border flex items-center justify-center text-foreground hover:text-emerald-500 hover:bg-accent hover:scale-110 active:scale-95 transition-all shadow-lg outline-none"
            >
              <RefreshCw className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
              title="Preview full screen"
              className="w-10 h-10 rounded-full bg-background/90 border border-border flex items-center justify-center text-foreground hover:text-emerald-500 hover:bg-accent hover:scale-110 active:scale-95 transition-all shadow-lg outline-none"
            >
              <Maximize2 className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Delete Image"
              className="w-10 h-10 rounded-full bg-background/90 border border-border flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 hover:scale-110 active:scale-95 transition-all shadow-lg outline-none"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          /* 2. Change Source Selection Overlay with enhanced contrast */
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shadow-sm">Change image using...</p>
            
            <div className="flex flex-row items-center justify-center gap-1.5 w-full max-w-full overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => { onTriggerReplace(); setIsChanging(false); }}
                className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1 px-3 shrink-0 transition-all outline-none shadow-md"
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
              {showGallery && (
                <button
                  type="button"
                  onClick={() => { onTriggerGallery(); setIsChanging(false); }}
                  className="h-8 rounded-xl text-[10px] font-bold bg-background border border-input text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1 px-3 shrink-0 transition-all outline-none shadow-md"
                >
                  <FolderHeart className="w-3.5 h-3.5" /> Media
                </button>
              )}
              <button
                type="button"
                onClick={() => { onOpenLink(); setIsChanging(false); }}
                className="h-8 rounded-xl text-[10px] font-bold bg-background border border-input text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1 px-3 shrink-0 transition-all outline-none shadow-md"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Link
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsChanging(false)}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors outline-none"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>
        )}
      </div>

      {/* Full screen preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl bg-background border-border p-4 flex flex-col gap-3 rounded-2xl text-foreground">
          <DialogHeader className="border-b border-border pb-2">
            <DialogTitle className="text-sm font-bold text-foreground tracking-wide truncate">
              {getFilenameFromUrl(imageUrl)}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground font-medium flex gap-3">
              {metadata.size ? <span>Size: {metadata.size}</span> : null}
              {metadata.dimensions ? <span>Dimensions: {metadata.dimensions}</span> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/30 rounded-xl p-2 min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Full size preview" className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
