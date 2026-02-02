'use client';

import VideoEmbed from '@/components/video-embed';

export default function WelcomeSection() {
  return (
    <section className="bg-background py-20 text-center md:py-28">
      <div className="container">
        <h2 className="mb-4 font-headline text-3xl font-bold text-foreground md:text-4xl">
          Welcome to the <span className="text-primary">SmartSapp</span> Family
        </h2>
        <p className="mb-4 text-lg text-muted-foreground">
          Your child's school has signed up on SmartSapp.
          <br />
          Here is a quick video to help you understand what it means for you as a parent.
        </p>
        <p className="mb-10 text-lg font-semibold text-foreground">
          Please watch the full video. It's super important!
        </p>
        <div className="mx-auto max-w-[60%]">
            <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
        </div>
      </div>
    </section>
  );
}
