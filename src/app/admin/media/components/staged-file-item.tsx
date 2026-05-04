'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { File as FileIcon, X, CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface FileState {
  id: string;
  file: File;
  status: 'pending' | 'editing' | 'processing' | 'completed' | 'error';
  progress: number;
  dimensions?: { width: number; height: number };
  dataUrl?: string;
  editingState?: any; // To avoid circular imports, type can be tightened if needed
}

interface StagedFileItemProps {
  fileState: FileState;
  isActive: boolean;
  isUploading: boolean;
  onSelect: (id: string) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
  isImage: boolean;
}

export function StagedFileItem({
  fileState,
  isActive,
  isUploading,
  onSelect,
  onRemove,
  isImage
}: StagedFileItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-xl bg-card cursor-pointer transition-all",
        isActive ? "ring-2 ring-primary border-primary/50 shadow-sm" : "hover:border-primary/30"
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(fileState.id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(fileState.id)}
    >
      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border">
        {isImage && fileState.dataUrl ? (
          <img src={fileState.dataUrl} alt="thumbnail" className="h-full w-full object-cover" />
        ) : (
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-foreground">{fileState.file.name}</p>
        
        {fileState.status === 'pending' && (
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>{(fileState.file.size / 1024).toFixed(2)} KB</span>
                {fileState.dimensions && (
                    <>
                        <span>•</span>
                        <span>{fileState.dimensions.width}×{fileState.dimensions.height}</span>
                    </>
                )}
            </p>
        )}
        
        {fileState.status === 'processing' && (
            <div className="flex items-center gap-2 mt-1">
                <Progress value={fileState.progress} className="h-1.5 flex-1" />
                <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">
                    {Math.round(fileState.progress)}%
                </span>
            </div>
        )}
        
        {fileState.status === 'completed' && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mt-0.5">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Uploaded successfully</span>
            </div>
        )}
        
        {fileState.status === 'error' && (
            <p className="text-xs font-semibold text-destructive mt-0.5">Upload failed</p>
        )}
      </div>

      {!isUploading && (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0" 
            onClick={(e) => onRemove(e, fileState.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      {isUploading && fileState.status === 'processing' && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mr-2" />
      )}
    </motion.div>
  );
}
