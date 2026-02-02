'use client';

import VideoEmbed from '@/components/video-embed';

export default function WelcomeSection() {
  return (
    <section className="bg-white py-20 text-center md:py-28">
      <div className="container">
        <h1 className="mb-6 font-headline text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl lg:text-6xl">
          Welcome to the <span className="text-primary">SmartSapp</span> Family
        </h1>
        <p className="mb-4 text-lg leading-relaxed text-gray-600">
          Your child's school has signed up on SmartSapp.
          <br />
          Here is a quick video to help you understand what it means for you as a parent.
        </p>
        <p className="mb-10 text-lg font-semibold text-gray-800">
          Please watch the full video. It's super important!
        </p>
        <div className="mx-auto mt-16 max-w-[70%] md:max-w-[60%]">
          <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
        </div>
      </div>
    </section>
  );
}
