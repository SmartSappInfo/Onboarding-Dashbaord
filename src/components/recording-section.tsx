'use client';

import VideoEmbed from '@/components/video-embed';

interface RecordingSectionProps {
  recordingUrl: string;
}

export default function RecordingSection({ recordingUrl }: RecordingSectionProps) {
  return (
    <section id="recording" className="bg-card py-16 md:py-24">
      <div className="container text-center">
        <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
          Watch the Meeting Recording
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          If you missed the session or want to review the information, you can watch the full recording below.
        </p>
        <div className="mx-auto max-w-4xl">
            <VideoEmbed url={recordingUrl} />
        </div>
      </div>
    </section>
  );
}
