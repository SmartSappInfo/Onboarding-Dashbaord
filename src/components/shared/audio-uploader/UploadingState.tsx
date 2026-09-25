import React from 'react';
import { Loader2, Music } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UploadingStateProps {
  progress: number;
  fileName?: string;
  className?: string;
}

export function UploadingState({ progress, fileName, className }: UploadingStateProps) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-6 flex flex-col items-center justify-center gap-4 text-center min-h-[220px]",
        className
      )}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <Music className="w-6 h-6 animate-pulse text-violet-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-border shadow-xs">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-[200px] w-full">
        <p className="text-xs font-bold text-foreground truncate">
          {fileName || 'Uploading audio...'}
        </p>
        <Progress value={progress} className="h-1.5" />
        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          {progress}% uploaded
        </p>
      </div>
    </div>
  );
}
