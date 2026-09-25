import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, FolderHeart, Link as LinkIcon, Upload, ArrowLeft, AudioWaveform, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadedStateProps {
  audioUrl: string;
  fileName?: string;
  showGallery: boolean;
  onTriggerReplace: () => void;
  onTriggerGallery: () => void;
  onOpenLink: () => void;
  onRemove: () => void;
}

export function UploadedState({
  audioUrl,
  fileName,
  showGallery,
  onTriggerReplace,
  onTriggerGallery,
  onOpenLink,
  onRemove
}: UploadedStateProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [audioUrl]);

  const getDisplayName = (url: string, explicitName?: string): string => {
    if (explicitName) return explicitName;
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('?')[0] || 'Audio Clip';
    } catch {
      return 'Audio Clip';
    }
  };

  const displayName = getDisplayName(audioUrl, fileName);

  return (
    <div className="w-full">
      {isChanging ? (
        <div className="w-full rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-200 min-h-[160px]">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
            Change audio source…
          </p>
          <div className="flex flex-row items-center justify-center gap-1.5 w-full max-w-full overflow-x-auto scrollbar-none">
            <Button
              type="button"
              size="sm"
              onClick={() => { onTriggerReplace(); setIsChanging(false); }}
              className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1 px-3 shrink-0 active:scale-[0.97] transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Upload
            </Button>
            {showGallery && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onTriggerGallery(); setIsChanging(false); }}
                className="h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1 px-3 shrink-0 active:scale-[0.97] transition-all"
              >
                <FolderHeart className="w-3.5 h-3.5" /> Library
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { onOpenLink(); setIsChanging(false); }}
              className="h-8 rounded-xl text-[10px] font-bold bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1 px-3 shrink-0 active:scale-[0.97] transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" /> Link
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setIsChanging(false)}
            className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mt-1"
          >
            <ArrowLeft className="w-3 h-3" /> Cancel
          </button>
        </div>
      ) : (
        <div className="border border-border/80 bg-card rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                <AudioWaveform className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">
                  Ready for playback
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsChanging(true)}
                className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Change Audio"
                aria-label="Change Audio"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remove Audio"
                aria-label="Remove Audio"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="pt-1 space-y-1">
            <audio 
              controls 
              src={audioUrl} 
              onError={() => setLoadError(true)}
              className="w-full h-10 min-h-[40px] rounded-lg"
            >
              Your browser does not support the audio element.
            </audio>
            {loadError && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Unable to load audio preview. Check URL accessibility or permissions.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
