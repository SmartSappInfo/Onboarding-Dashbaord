'use client';

import VideoEmbed from '@/components/video-embed';

export default function SetupProfileSection() {
  return (
    <section
      id="setup-profile"
      className="bg-white py-20 text-center md:py-28"
    >
      <div className="container">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          2
        </div>
        <h2 className="mb-4 font-headline text-3xl font-bold text-gray-900 md:text-4xl">
          How to setup your profile and Confirm your child&apos;s details
        </h2>
        <p className="mb-8 text-lg text-gray-700">
          <a
            href="https://youtu.be/WJRKrl5S5tM"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Here&apos;s a help video
          </a>
        </p>
        <div className="mx-auto w-full md:max-w-[60%]">
          <VideoEmbed url="https://youtu.be/WJRKrl5S5tM" />
        </div>
      </div>
    </section>
  );
}
