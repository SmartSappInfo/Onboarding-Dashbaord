'use client';

import VideoEmbed from '@/components/video-embed';

export default function SetupProfileSection() {
  return (
    <section
      id="setup-profile"
      className="bg-white py-20 text-center text-gray-800 md:py-28 dark:bg-background dark:text-foreground"
    >
      <div className="container">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          2
        </div>
        <h2 className="mb-4 font-headline text-3xl font-bold text-gray-900 md:text-4xl dark:text-foreground">
          How to setup your profile and Confirm your child&apos;s details
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-lg">
          <a
            href="https://youtu.be/WJRKrl5S5tM"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Here&apos;s a help video
          </a>
        </p>
        <VideoEmbed url="https://youtu.be/WJRKrl5S5tM" />
      </div>
    </section>
  );
}
