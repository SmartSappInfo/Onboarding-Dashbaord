import React, { useState } from 'react';
import { MoreVertical, Download, Copy, Maximize2, RefreshCw, FolderHeart, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface UploadedStateProps {
  imageUrl: string;
  showGallery: boolean;
  onTriggerReplace: () => void;
  onTriggerGallery: () => void;
  onRemove: () => void;
}

export function UploadedState({ imageUrl, showGallery, onTriggerReplace, onTriggerGallery, onRemove }: UploadedStateProps) {
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast({ title: 'URL Copied', description: 'Image link copied to your clipboard.' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = imageUrl.split('/').pop()?.split('?')[0] || 'downloaded-image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Download Started' });
    } catch (error: unknown) {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="w-full">
      <div className="relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center group cursor-pointer" onClick={() => setPreviewOpen(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Uploaded asset" className="w-full h-full object-cover" />
        
        {/* Overlay with subtle details */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform">
            <Maximize2 className="w-4 h-4" />
          </div>
        </div>

        {/* Options Dropdown - StopPropagation to prevent opening full screen preview */}
        <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Image actions" className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg outline-none">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl bg-slate-900 border-slate-800 text-slate-200">
              <DropdownMenuItem onClick={() => setPreviewOpen(true)} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                <Maximize2 className="w-3.5 h-3.5" /> Preview Full Screen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                <Download className="w-3.5 h-3.5" /> Download Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyUrl} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                <Copy className="w-3.5 h-3.5" /> Copy Image Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTriggerReplace} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                <RefreshCw className="w-3.5 h-3.5" /> Replace from Device
              </DropdownMenuItem>
              {showGallery && (
                <DropdownMenuItem onClick={onTriggerGallery} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                  <FolderHeart className="w-3.5 h-3.5" /> Select from Gallery
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onRemove} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800 text-red-400 focus:text-red-300">
                <Trash2 className="w-3.5 h-3.5" /> Delete Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Full screen preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl bg-slate-950/95 border-slate-900 p-2 overflow-hidden flex items-center justify-center rounded-2xl">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <DialogDescription className="sr-only">Full size view of uploaded asset</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Full screen preview" className="max-h-[85vh] max-w-full object-contain rounded-xl" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
