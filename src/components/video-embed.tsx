'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

export type VideoPlayButtonArchetype =
  | 'pulse'
  | 'glass-pill'
  | 'minimal-badge'
  | 'standard';

export type VideoControlsTheme =
  | 'standard'
  | 'minimal-line'
  | 'ghost'
  | 'floating-island';

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
 * Supports 4 motion archetypes: 'pulse' (radar waves), 'glass-pill' ("Watch Demo ▶"), 'minimal-badge' (discreet corner badge), 'standard' (classic disc).
 * CAUTION: Uses pointer-events-none & z-10 so mobile tap/click events pass cleanly to parent cards or buttons.
 */
export function VideoPlayButtonOverlay({ 
  label = "TAP TO WATCH VIDEO", 
  className,
  archetype = 'standard',
}: { 
  label?: string; 
  className?: string;
  archetype?: VideoPlayButtonArchetype;
}) {
  if (archetype === 'pulse') {
    return (
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors duration-300 pointer-events-none z-10 select-none", className)}>
        {label && label !== "TAP TO WATCH VIDEO" && (
          <span className="text-[10px] font-black tracking-widest text-white uppercase mb-2.5 drop-shadow-md opacity-90">{label}</span>
        )}
        <div data-testid="radar-pulse-trigger" className="relative flex items-center justify-center">
          {/* Concentric expanding radar pulse rings */}
          <div className="absolute -inset-4 sm:-inset-6 rounded-full bg-blue-500/40 animate-ping pointer-events-none motion-reduce:hidden" />
          <div className="absolute -inset-2 sm:-inset-3 rounded-full bg-blue-500/25 animate-pulse duration-1000 pointer-events-none" />
          
          {/* Solid blue play disc */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-[0_0_35px_rgba(37,99,235,0.6)] border-2 border-white/40 transform transition-all duration-300 group-hover:scale-110 active:scale-95">
            <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-current ml-0.5 drop-shadow-md" />
          </div>
        </div>
      </div>
    );
  }

  if (archetype === 'glass-pill') {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors duration-300 pointer-events-none z-10 select-none", className)}>
        <div data-testid="glass-pill-trigger" className="px-5 py-2.5 rounded-full bg-black/50 hover:bg-black/65 backdrop-blur-md border border-white/30 text-white shadow-xl flex items-center gap-2 transform transition-all duration-300 group-hover:scale-105 active:scale-95">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-tight text-white drop-shadow">
            {label && label !== "TAP TO WATCH VIDEO" ? label : "Watch Demo ▶"}
          </span>
        </div>
      </div>
    );
  }

  if (archetype === 'minimal-badge') {
    return (
      <div className={cn("absolute inset-0 pointer-events-none z-10 select-none", className)}>
        <div data-testid="minimal-badge-trigger" className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20 text-white shadow-lg flex items-center gap-1.5 transition-transform duration-200 group-hover:scale-105">
          <Play className="w-3.5 h-3.5 fill-current text-white ml-0.5" />
          <span className="text-[11px] font-bold text-white tracking-wide">
            {label && label !== "TAP TO WATCH VIDEO" ? label : "2 min"}
          </span>
        </div>
      </div>
    );
  }

  // 'standard' classic disc
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors duration-300 pointer-events-none z-10 select-none", className)}>
      {label && (
        <span className="text-[10px] font-black tracking-widest text-white uppercase mb-2.5 drop-shadow-md opacity-90">{label}</span>
      )}
      <div data-testid="standard-play-trigger" className="relative flex items-center justify-center">
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

export interface VideoEmbedProps {
  url?: string;
  thumbnailUrl?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  disabled?: boolean;
  title?: string;
  description?: string;
  showOverlayText?: boolean;
  playButtonArchetype?: VideoPlayButtonArchetype;
  controlsTheme?: VideoControlsTheme;
  hoverPreview?: boolean;
  overlayTint?: 'none' | 'dark-30' | 'dark-50';
}

const VideoEmbed = ({ 
  url, 
  thumbnailUrl, 
  className, 
  autoPlay = false, 
  muted = false,
  loop = false,
  disabled = false,
  title,
  description,
  showOverlayText = false,
  playButtonArchetype = 'standard',
  controlsTheme = 'standard',
  hoverPreview = false,
  overlayTint = 'none',
}: VideoEmbedProps) => {
  const safeUrl = sanitizeVideoUrl(url);
  const [isPlaying, setIsPlaying] = React.useState(autoPlay && !disabled);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(autoPlay ? true : muted);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(thumbnailUrl || null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
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
    if (autoPlay) {
      setIsMuted(true);
    }
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

  const activePlaying = isPlaying || (hoverPreview && isHovering && !disabled);
  const hideControls = controlsTheme === 'minimal-line' || controlsTheme === 'ghost';
  const showControlsParam = hideControls ? 0 : 1;
  const effectiveMuteParam = isMuted ? 1 : 0;

  // Click-to-play thumbnail logic
  if (!activePlaying && (videoId || vimeoId || loomId || isDirectFile)) {
    return (
      <div 
        className={cn(
          "relative aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group cursor-pointer select-none [isolation:isolate] [-webkit-mask-image:-webkit-radial-gradient(white,black)]",
          className
        )}
        onClick={() => {
          if (disabled) return;
          setIsPlaying(true);
        }}
        onMouseEnter={() => {
          if (hoverPreview && !disabled) {
            setIsHovering(true);
          }
        }}
        onMouseLeave={() => {
          if (hoverPreview && !disabled) {
            setIsHovering(false);
          }
        }}
      >
        {/* Background Thumbnail */}
        {thumbUrl ? (
          <Image 
            src={thumbUrl} 
            alt={title || "Video thumbnail"}
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

        {/* Dark Tint Overlay on Thumbnail */}
        {overlayTint === 'dark-30' && (
          <div className="absolute inset-0 bg-black/30 pointer-events-none z-10" />
        )}
        {overlayTint === 'dark-50' && (
          <div className="absolute inset-0 bg-black/50 pointer-events-none z-10" />
        )}
        
        <VideoPlayButtonOverlay
          archetype={playButtonArchetype}
          label={playButtonArchetype === 'standard' ? "TAP TO WATCH VIDEO" : undefined}
        />

        {/* Overlay Title & Description at Bottom of Thumbnail */}
        {showOverlayText && (title || description) && (
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none z-10 text-left">
            {title && (
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow line-clamp-2 leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs sm:text-sm text-white/85 line-clamp-2 mt-1 leading-snug drop-shadow-sm">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Tap-to-unmute toggle overlay component
  const unmuteToggle = activePlaying && isMuted && !disabled && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsMuted(false);
        if (videoRef.current) {
          videoRef.current.muted = false;
        }
      }}
      aria-label="Tap to Unmute"
      data-testid="tap-to-unmute-toggle"
      className="absolute bottom-3 left-3 z-30 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-transform duration-200 active:scale-95 cursor-pointer pointer-events-auto"
    >
      <span>Tap to Unmute 🔇</span>
      <div className="flex items-end gap-0.5 h-3">
        <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="w-0.5 h-3 bg-emerald-400 rounded-full" />
        <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
      </div>
    </button>
  );

  // Minimal-line micro-scrubber overlay
  const minimalLineScrubber = controlsTheme === 'minimal-line' && (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 z-20 pointer-events-none">
      <div className="h-full bg-blue-500 w-2/3" />
    </div>
  );

  // Dark tint overlay for active playback
  const tintOverlay = (
    <>
      {overlayTint === 'dark-30' && (
        <div className="absolute inset-0 bg-black/30 pointer-events-none z-10" />
      )}
      {overlayTint === 'dark-50' && (
        <div className="absolute inset-0 bg-black/50 pointer-events-none z-10" />
      )}
    </>
  );

  if (isDirectFile) {
    return (
      <div 
        className={cn(
          "aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black relative [isolation:isolate] [-webkit-mask-image:-webkit-radial-gradient(white,black)]",
          disabled && "pointer-events-none",
          className
        )}
        onMouseLeave={() => {
          if (hoverPreview && !isPlaying) {
            setIsHovering(false);
          }
        }}
      >
        <video 
          ref={videoRef}
          src={safeUrl || url} 
          className="w-full h-full object-cover" 
          controls={!hideControls && !disabled} 
          autoPlay={!disabled}
          muted={disabled || isMuted}
          loop={loop}
          playsInline
        />
        {tintOverlay}
        {unmuteToggle}
        {minimalLineScrubber}
      </div>
    );
  }

  let embedUrl = "";
  if (videoId) {
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${disabled ? 0 : 1}&mute=${disabled ? 1 : effectiveMuteParam}&controls=${showControlsParam}&loop=${loop ? 1 : 0}&playlist=${videoId}&rel=0&modestbranding=1&enablejsapi=1`;
  }
  if (vimeoId) {
    embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=${disabled ? 0 : 1}&muted=${disabled ? 1 : effectiveMuteParam}&loop=${loop ? 1 : 0}&background=${hideControls ? 1 : 0}`;
  }
  if (loomId) {
    embedUrl = `https://www.loom.com/embed/${loomId}?autoplay=${disabled ? 0 : 1}&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`;
  }

  return (
    <div 
      className={cn(
        "aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black relative [isolation:isolate] [-webkit-mask-image:-webkit-radial-gradient(white,black)]",
        disabled && "pointer-events-none",
        className
      )}
      onMouseLeave={() => {
        if (hoverPreview && !isPlaying) {
          setIsHovering(false);
        }
      }}
    >
      <iframe
        width="100%"
        height="100%"
        src={embedUrl}
        title="Video player"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className={disabled ? "pointer-events-none" : undefined}
      ></iframe>
      {tintOverlay}
      {unmuteToggle}
      {minimalLineScrubber}
    </div>
  );
};

export default VideoEmbed;
