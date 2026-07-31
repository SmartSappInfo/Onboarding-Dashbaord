
'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

/**
 * Helper to validate external video URLs and prevent malicious XSS protocols (e.g., javascript:).
 * CAUTION: Essential for security compliance to prevent arbitrary script execution.
 */
function sanitizeVideoUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return null;
}

function extractYouTubeID(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function extractVimeoID(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function extractLoomID(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

interface VideoEmbedProps {
  url?: string;
  thumbnailUrl?: string;
  className?: string;
  autoPlay?: boolean;
  disabled?: boolean;
}

const VideoEmbed = ({ url, thumbnailUrl, className, autoPlay = false, disabled = false }: VideoEmbedProps) => {
  const safeUrl = sanitizeVideoUrl(url);
  const [isPlaying, setIsPlaying] = React.useState(autoPlay && !disabled);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(thumbnailUrl || null);
  
  const videoId = extractYouTubeID(safeUrl || undefined);
  const vimeoId = extractVimeoID(safeUrl || undefined);
  const loomId = extractLoomID(safeUrl || undefined);

  // CAUTION: Detect direct hosted video files (.mp4, .webm, .mov, .m4v, Firebase Storage tokens, or direct media paths)
  const isDirectFile = safeUrl 
    ? (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(safeUrl) || 
       safeUrl.includes('/media%2Fvideo') || 
       safeUrl.includes('/video/') || 
       (!videoId && !vimeoId && !loomId && (safeUrl.startsWith('http://') || safeUrl.startsWith('https://')))) 
    : false;

  React.useEffect(() => {
    setIsPlaying(autoPlay && !disabled);
  }, [autoPlay, disabled]);

  React.useEffect(() => {
    if (thumbnailUrl) {
      setThumbUrl(thumbnailUrl);
    } else if (videoId) {
      setThumbUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    }
  }, [videoId, thumbnailUrl]);

  if (!videoId && !vimeoId && !loomId && !isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl bg-muted/30 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50", className)}>
            <Play className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium italic">Video source unsupported or unavailable.</p>
        </div>
    );
  }

  // Click-to-play thumbnail logic
  if (!isPlaying && (videoId || vimeoId || loomId || isDirectFile)) {
    return (
      <div 
        className={cn(
          "relative aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group cursor-pointer select-none",
          className
        )}
        onClick={() => {
          if (disabled) return;
          setIsPlaying(true);
        }}
      >
        {/* Background Thumbnail */}
        {thumbUrl ? (
          <Image 
            src={thumbUrl} 
            alt="Video thumbnail"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
            className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
            onError={() => {
              if (thumbUrl.includes('maxresdefault') && videoId) {
                setThumbUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
              } else {
                setThumbUrl(null);
              }
            }}
          />
        ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-950 flex items-center justify-center overflow-hidden">
                <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl" />
                <Play className="w-20 h-20 text-white/10" />
            </div>
        )}
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 opacity-70 group-hover:opacity-50 transition-opacity" />
        
        {/* Premium Large Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Outer animated ping ring */}
            <div className="absolute -inset-4 sm:-inset-6 rounded-full bg-primary/35 animate-ping pointer-events-none" />
            {/* Soft pulsing aura ring */}
            <div className="absolute -inset-2 sm:-inset-3 rounded-full bg-primary/25 animate-pulse duration-1000 pointer-events-none" />
            
            {/* Main Play Button Circle */}
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(59,95,255,0.5)] border-2 border-white/30 transform transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_70px_rgba(59,95,255,0.7)] group-hover:bg-primary/95 active:scale-95">
              <Play className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white fill-current ml-1 drop-shadow-md" />
            </div>
          </div>
        </div>
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between opacity-90 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            </div>
            <p className="text-white font-bold text-sm sm:text-lg md:text-xl drop-shadow-lg leading-tight">
              Watch Video
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black relative", disabled && "pointer-events-none", className)}>
            <video 
                src={safeUrl || url} 
                className="w-full h-full object-cover" 
                controls={!disabled} 
                autoPlay={!disabled}
                muted={disabled}
                playsInline
            />
        </div>
    );
  }

  let embedUrl = "";
  if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${disabled ? 0 : 1}&rel=0&modestbranding=1`;
  if (vimeoId) embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=${disabled ? 0 : 1}`;
  if (loomId) embedUrl = `https://www.loom.com/embed/${loomId}?autoplay=${disabled ? 0 : 1}`;

  return (
    <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black relative", disabled && "pointer-events-none", className)}>
      <iframe
        width="100%"
        height="100%"
        src={embedUrl}
        title="Video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={disabled ? "pointer-events-none" : undefined}
      ></iframe>
    </div>
  );
};

export default VideoEmbed;
