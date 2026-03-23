
import { cn } from '@/lib/utils';

function extractYouTubeID(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

interface VideoEmbedProps {
  url?: string;
  className?: string;
}

const VideoEmbed = ({ url, className }: VideoEmbedProps) => {
  const videoId = extractYouTubeID(url);
  const isDirectFile = url?.match(/\.(mp4|webm|ogg)$/i);

  if (!videoId && !isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl bg-muted flex items-center justify-center text-center p-8", className)}>
            <p className="text-muted-foreground font-medium italic">Video source unsupported or unavailable.</p>
        </div>
    );
  }

  if (isDirectFile) {
    return (
        <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black", className)}>
            <video 
                src={url} 
                className="w-full h-full" 
                controls 
                playsInline
            />
        </div>
    );
  }

  return (
    <div className={cn("aspect-video w-full rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-black", className)}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default VideoEmbed;
