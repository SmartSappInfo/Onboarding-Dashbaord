
'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

function extractYouTubeID(url?: string): string | null {
  if (!url) return null;
  // Support standard watch URLs, embed URLs, youtu.be, and shorts
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

interface VideoEmbedProps {
  url?: string;
  className?: string;
}

const VideoEmbed = ({ url, className }: VideoEmbedProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const videoId = extractYouTubeID(url);
  const isDirectFile = url?.match(/\.(mp4|webm|ogg)$/i);

  React.useEffect(() => {
    if (videoId) {
      setThumbUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    }
  }, [videoId]);

  if (!videoId && !isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl bg-muted/30 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50", className)}>
            <Play className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium italic">Video source unsupported or unavailable.</p>
        </div>
    );
  }

  if (isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black group", className)}>
            <video 
                src={url} 
                className="w-full h-full" 
                controls 
                playsInline
            />
        </div>
    );
  }

  // YouTube logic
  if (!isPlaying && videoId) {
    return (
      <div 
        className={cn(
          "relative aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group cursor-pointer",
          className
        )}
        onClick={() => setIsPlaying(true)}
      >
        {/* Background Thumbnail with Next.js Image Optimization */}
        {thumbUrl && (
          <Image 
            src={thumbUrl} 
            alt="Video thumbnail"
            fill
            priority
            className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-80"
            onError={() => {
              if (thumbUrl.includes('maxresdefault')) {
                setThumbUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
              }
            }}
          />
        )}
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        {/* Premium Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
                {/* Pulsing rings */}
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse duration-1000" />
                
                {/* Main Button */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(59,95,255,0.6)]">
                    <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                </div>
            </div>
        </div>
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-current" />
                </div>
                <p className="text-white font-bold text-lg sm:text-xl drop-shadow-lg">Click to Play Video</p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black", className)}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default VideoEmbed;
