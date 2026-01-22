import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import FindSchoolForm from '@/components/find-school-form';

export default function Home() {
  return (
    <>
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div className="text-center md:text-left">
              <h1 className="mb-4 font-headline text-4xl font-black tracking-tighter text-primary md:text-5xl lg:text-6xl">
                Onboarding Portal
              </h1>
              <p className="mb-8 max-w-xl text-lg text-muted-foreground mx-auto md:mx-0">
                Welcome to SmartSapp. Find your school to get started with the
                onboarding process.
              </p>
              <FindSchoolForm />
            </div>
            <div>
              <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
            </div>
          </div>
        </div>
      </section>

      <div className="container space-y-16 py-16 md:space-y-24 md:py-24">
        {/* Section 1: Download */}
        <section id="download" className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            1
          </div>
          <h2 className="mb-2 font-headline text-3xl font-bold">
            Want to get Started?
          </h2>
          <p className="mb-4 text-muted-foreground">
            You can download SmartSapp below by clicking the icon that applies to your phone type
          </p>
          <p className="mb-8">
            <a href="#download-links" className="font-semibold text-primary hover:underline">
              Click To Download Now!
            </a>
          </p>
          <div id="download-links">
            <AppStoreButtons />
          </div>
        </section>

        {/* Section 2: Setup */}
        <section id="setup-profile" className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            2
          </div>
          <h2 className="mb-2 font-headline text-3xl font-bold">
            How to setup your profile and Confirm your child&apos;s details
          </h2>
          <p className="mb-8">
            <a href="https://youtu.be/WJRKrl5S5tM" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              Here&apos;s a help video
            </a>
          </p>
          <VideoEmbed url="https://youtu.be/WJRKrl5S5tM" />
        </section>
      </div>
    </>
  );
}
