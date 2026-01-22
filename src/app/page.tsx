import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';

export default function Home() {
  return (
    <div className="container py-12 md:py-16">
      <div className="text-center">
        <h1 className="mb-4 font-headline text-4xl font-black tracking-tight text-primary md:text-5xl">
          Welcome Onboard
        </h1>
        <div className="mx-auto max-w-3xl space-y-2 text-base text-muted-foreground md:text-lg">
          <p>Your child&apos;s school has signed up on SmartSapp</p>
          <p>Here is a quick video to help you understand what it means for you as a parent</p>
          <p className="font-semibold text-foreground">Please watch full video, It&apos;s super important</p>
        </div>
        <div className="mt-8 md:mt-12">
          <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
        </div>
      </div>
      
      <section id="download" className="mt-16 rounded-xl bg-card p-8 text-center shadow-lg md:mt-24 md:p-12">
        <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Download the App</h2>
        <p className="mx-auto mb-10 max-w-3xl text-lg text-muted-foreground">
          Get the SmartSapp mobile app to stay connected on the go. Available on all major platforms.
        </p>
        <AppStoreButtons />
      </section>
    </div>
  );
}
