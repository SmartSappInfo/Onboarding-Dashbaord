import React, { useState } from 'react';
import { Film, Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onTriggerReplace: () => void;
  onOpenGallery: () => void;
  onOpenLink: () => void;
  showGallery: boolean;
  maxSizeMB: number;
  className?: string;
}

export function EmptyState({
  onTriggerReplace,
  onOpenGallery,
  onOpenLink,
  showGallery,
  maxSizeMB,
  className
}: EmptyStateProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2 border-dashed transition-all duration-300 p-6 flex flex-col items-center justify-center gap-4 text-center cursor-pointer min-h-[220px]",
        dragActive
          ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]"
          : "border-border bg-muted/20 hover:border-muted-foreground/30",
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={onTriggerReplace}
    >
      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
        <Film className="w-5 h-5" />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-foreground hidden md:block">
          Drag & drop video here or click to browse
        </p>
        <p className="text-xs font-bold text-foreground block md:hidden">
          Tap to upload video or browse
        </p>
        <p className="text-[10px] font-medium text-muted-foreground">
          MP4 • MOV • AVI • Max {maxSizeMB}MB
        </p>
      </div>

      <div
        className="flex flex-row items-center justify-center gap-1.5 w-full max-w-full overflow-x-auto scrollbar-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          onClick={onTriggerReplace}
          className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1 px-2.5 shrink-0 active:scale-[0.97] transition-transform duration-150"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Video
        </Button>
        {showGallery && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenGallery}
            className="h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground gap-1 px-2.5 shrink-0 active:scale-[0.97] transition-transform duration-150"
          >
            <FolderHeart className="w-3.5 h-3.5" /> Media Gallery
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenLink}
          className="h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground gap-1 px-2.5 shrink-0 active:scale-[0.97] transition-transform duration-150"
        >
          <LinkIcon className="w-3.5 h-3.5" /> Link URL
        </Button>
      </div>
    </div>
  );
}
