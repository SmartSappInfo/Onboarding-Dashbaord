import React, { useRef, useState } from 'react';
import { Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onFileSelect: (file: File) => void;
  onOpenGallery: () => void;
  onOpenLink: () => void;
  showGallery: boolean;
  maxSizeMB: number;
  className?: string;
}

export function EmptyState({ onFileSelect, onOpenGallery, onOpenLink, showGallery, maxSizeMB, className }: EmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2 border-dashed transition-all duration-300 p-6 flex flex-col items-center justify-center gap-4 text-center cursor-pointer min-h-[220px]",
        dragActive ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]" : "border-slate-800 bg-slate-900/10 hover:border-slate-700",
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      
      <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
        <Upload className="w-5 h-5" />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-300 hidden md:block">
          Drag & drop image here or click to browse
        </p>
        <p className="text-xs font-bold text-slate-300 block md:hidden">
          Tap to upload image or browse
        </p>
        <p className="text-[10px] font-medium text-slate-500">
          PNG • JPG • WEBP • Max {maxSizeMB}MB
        </p>
      </div>

      <div className="flex gap-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
        <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 px-3">
          <Upload className="w-3 h-3" /> Upload
        </Button>
        {showGallery && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenGallery} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 px-3">
            <FolderHeart className="w-3 h-3" /> Gallery
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onOpenLink} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 px-3">
          <LinkIcon className="w-3 h-3" /> Link
        </Button>
      </div>
    </div>
  );
}
