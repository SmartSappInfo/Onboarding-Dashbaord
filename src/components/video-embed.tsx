
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

/**
 * PURPOSE: Single source of truth for video play button overlays across inline play and modal components.
 * CAUTION: Uses solid blue palette (bg-blue-600) matching the designer theme. Overlay container and inner rings use
 * pointer-events-none & z-10 so mobile tap/click events pass cleanly to parent cards or buttons.
 * TESTABILITY: Rendered in VideoEmbed thumbnail state, Testimonial cards, Video blocks, and Testimonial Grid headers.
 * RELATED SURFACES: testimonial.tsx, video.tsx, testimonial-grid.tsx, PublicPageClient.tsx.
 */
export function VideoPlayButtonOverlay({ 
  label = "TAP TO WATCH VIDEO", 
  className 
}: { 
  label?: string; 
  className?: string 
}) {
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors duration-300 pointer-events-none z-10 select-none", className)}>
      {label && (
        <span className="text-[10px] font-black tracking-widest text-white uppercase mb-2.5 drop-shadow-md opacity-90">{label}</span>
      )}
      <div className="relative flex items-center justify-center">
        {/* Pulsing blue outer aura rings matching designer palette */}
        <div className="absolute -inset-3.5 rounded-full bg-blue-500/40 animate-ping pointer-events-none" />
        <div className="absolute -inset-1.5 rounded-full bg-blue-500/25 animate-pulse duration-1000 pointer-events-none" />
        
        {/* Solid blue play button */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-[0_0_35px_rgba(37,99,235,0.6)] border-2 border-white/40 transform transition-all duration-300 group-hover:scale-110 active:scale-95">
          <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-current ml-0.5 drop-shadow-md" />
        </div>
      </div>
    </div>
  );
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
        
        <VideoPlayButtonOverlay label="TAP TO WATCH VIDEO" />
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
  if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${disabled ? 0 : 1}&rel=0&modestbranding=1&enablejsapi=1`;
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
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className={disabled ? "pointer-events-none" : undefined}
      ></iframe>
    </div>
  );
};

export default VideoEmbed;
