import React from 'react';
import { Edit2, RefreshCw, FolderHeart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadedStateProps {
  imageUrl: string;
  showGallery: boolean;
  onTriggerReplace: () => void;
  onTriggerGallery: () => void;
  onRemove: () => void;
}

export function UploadedState({ imageUrl, showGallery, onTriggerReplace, onTriggerGallery, onRemove }: UploadedStateProps) {
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 group bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Uploaded asset" className="w-full h-full object-cover" />
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform">
            <Edit2 className="w-4 h-4" />
          </div>
        </div>
        <button type="button" onClick={onTriggerReplace} aria-label="Replace Image" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg">
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={onTriggerReplace} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 flex-1 px-3">
          <RefreshCw className="w-3 h-3" /> Replace
        </Button>
        {showGallery && (
          <Button type="button" variant="outline" size="sm" onClick={onTriggerGallery} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 flex-1 px-3">
            <FolderHeart className="w-3 h-3" /> Gallery
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onRemove} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5 px-3">
          <Trash2 className="w-3 h-3" /> Remove
        </Button>
      </div>
    </div>
  );
}
