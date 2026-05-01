'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadDropzoneProps {
  onFilesDropped: (files: FileList | null) => void;
  isUploading: boolean;
  maxSizeMB: number;
}

export function UploadDropzone({ onFilesDropped, isUploading, maxSizeMB }: UploadDropzoneProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  };

  return (
    <form onSubmit={e => e.preventDefault()} onDragEnter={handleDrag} className="relative w-full">
      <input
        ref={inputRef}
        id="file-upload"
        type="file"
        multiple
        onChange={e => onFilesDropped(e.target.files)}
        className="hidden"
        disabled={isUploading}
      />
      <motion.label
        htmlFor="file-upload"
        animate={{
            scale: dragActive ? 1.02 : 1,
            backgroundColor: dragActive ? 'rgba(var(--primary), 0.05)' : 'transparent',
            borderColor: dragActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors group",
          isUploading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/30"
        )}
      >
        <div className={cn(
            "p-4 rounded-full mb-4 transition-colors",
            dragActive ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"
        )}>
            <Upload className={cn(
                "h-8 w-8 transition-colors",
                dragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
            )} />
        </div>
        
        <p className="text-lg font-bold text-foreground tracking-tight">
          Drag & drop files here or <span className="text-primary hover:underline">browse</span>
        </p>
        
        <div className="flex flex-col gap-1 mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Supports Images, Videos, Audio, and Documents
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            GIF animation preservation included • Maximum {maxSizeMB}MB
          </p>
        </div>
      </motion.label>
      
      {dragActive && (
        <div 
            className="absolute inset-0 z-10" 
            onDragEnter={handleDrag} 
            onDragLeave={handleDrag} 
            onDragOver={handleDrag} 
            onDrop={handleDrop} 
        />
      )}
    </form>
  );
}
