function extractYouTubeID(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

interface VideoEmbedProps {
  url: string;
  className?: string;
}

const VideoEmbed = ({ url, className }: VideoEmbedProps) => {
  const videoId = extractYouTubeID(url);

  if (!videoId) {
    return <p>Invalid YouTube URL provided.</p>;
  }

  return (
    <div className={`aspect-video w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-2xl ${className}`}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default VideoEmbed;
