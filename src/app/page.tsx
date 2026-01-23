import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import FindSchoolForm from '@/components/find-school-form';

export default function Home() {
  const helpVideos = [
    'https://youtu.be/4zchas6SKtE',
    'https://youtu.be/1p5ICDnyzjk',
    'https://youtu.be/XuixxYGw02g',
    'https://youtu.be/qlK8TVipyDs',
    'https://youtu.be/akt0jFWqqPs',
    'https://youtu.be/XmP7rNPSRDc',
    'https://youtu.be/ORUNmDdXMZQ',
    'https://youtu.be/BNJ8jAw3MRE',
    'https://youtu.be/Ft7ViVtzX3U',
  ];

  return (
    <>
      <section className="py-16 text-center md:py-24">
        <div className="container">
          <h1 className="mb-4 font-headline text-4xl font-black tracking-tighter text-primary md:text-5xl lg:text-6xl">
            Onboarding Portal
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Welcome to SmartSapp. Find your school to get started with the
            onboarding process.
          </p>
          <FindSchoolForm />
          <div className="mt-12">
            <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
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

        {/* Section 3: Support & Help Videos */}
        <section id="support">
          <div className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            3
          </div>
          <div className="mx-auto max-w-3xl text-left">
            <p className="mb-4 text-lg text-muted-foreground">
              We try to make everything as seamless and smooth as possible, but sometimes things happen.
              So if you need support with anything or want to ask a question about SmartSapp, Please WhatsApp
              us on <a href="https://wa.me/233501626873" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">+233 50 162 6873</a>.
            </p>
            <p className="mb-4 text-lg text-muted-foreground">
              We look forward to making it easy for you to be involved with your child&apos;s school life.
            </p>
            <p className="text-lg font-semibold text-foreground">
              SmartSapp Team
            </p>
          </div>
          
          <h2 className="mb-12 mt-16 text-center font-headline text-3xl font-bold">
            Useful Help Videos
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {helpVideos.map((url, index) => (
              <VideoEmbed key={index} url={url} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
