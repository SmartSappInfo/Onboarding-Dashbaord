import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import FindSchoolForm from '@/components/find-school-form';
import { Card, CardContent } from '@/components/ui/card';

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

  const testimonials = [
    {
      videoUrl: 'https://youtu.be/sL2S_RzI2nc',
      quote:
        'Knowing only trusted, authorized people can pick up my child brings true peace of mind. SmartSapp ended the chaos and fear I once had at school pick-up.',
    },
    {
      videoUrl: 'https://youtu.be/VrHNh6G1U3k',
      quote:
        'With just a one-tap alert, you can quickly and securely pick up your child. SmartSapp simplifies school routines and ensures only trusted people can access your child—easy and worry-free.',
    },
    {
      videoUrl: 'https://youtu.be/p38wu6iQJ-c',
      quote:
        'SmartSapp gives me peace of mind by notifying me whenever my children are dropped off or picked up, ensuring their security and a smooth pick-up process.',
    },
    {
      videoUrl: 'https://youtu.be/ySSuTA-Bj1Y',
      quote:
        "I know my child is safe, and I can easily update the school if my child is sick or when I'm on my way to pick them up - peace of mind for busy parents",
    },
  ];

  return (
    <div className="space-y-16 py-16 md:space-y-24 md:py-24">
      <section className="text-center">
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

      {/* Section 1: Download */}
      <section id="download" className="text-center">
        <div className="container">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            1
          </div>
          <h2 className="mb-2 font-headline text-3xl font-bold">
            Want to get Started?
          </h2>
          <p className="mb-4 text-muted-foreground">
            You can download SmartSapp below by clicking the icon that applies
            to your phone type
          </p>
          <p className="mb-8">
            <a
              href="#download-links"
              className="font-semibold text-primary hover:underline"
            >
              Click To Download Now!
            </a>
          </p>
          <div id="download-links">
            <AppStoreButtons />
          </div>
        </div>
      </section>

      {/* Section 2: Setup */}
      <section id="setup-profile" className="text-center">
        <div className="container">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            2
          </div>
          <h2 className="mb-2 font-headline text-3xl font-bold">
            How to setup your profile and Confirm your child&apos;s details
          </h2>
          <p className="mb-8">
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

      {/* Section 3: Support & Help Videos */}
      <section id="support" className="text-center">
        <div className="container">
          <div className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            3
          </div>
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-lg text-muted-foreground">
              We try to make everything as seamless and smooth as possible, but
              sometimes things happen. So if you need support with anything or
              want to ask a question about SmartSapp, Please WhatsApp us on{' '}
              <a
                href="https://wa.me/233501626873"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                +233 50 162 6873
              </a>
              .
            </p>
            <p className="mb-4 text-lg text-muted-foreground">
              We look forward to making it easy for you to be involved with your
              child&apos;s school life.
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
        </div>
      </section>

      {/* Section 4: Testimonials */}
      <section id="testimonials" className="text-center">
        <div className="container">
          <h2 className="mb-4 font-headline text-3xl font-bold tracking-tight md:text-4xl">
            Why Parents and Schools are going
            <br />
            Wild over SmartSapp
          </h2>
          <p className="mx-auto mb-4 max-w-2xl text-lg text-muted-foreground">
            Watch these testimonials to see how parents are ensuring their
            child's security with SmartSapp
          </p>
          <p className="mb-12 text-lg font-semibold">
            👇 Click To Watch These Videos. It&apos;s Super Important👇
          </p>

          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="overflow-hidden text-left shadow-lg"
              >
                <VideoEmbed url={testimonial.videoUrl} />
                <CardContent className="p-6">
                  <p className="font-quote italic text-muted-foreground">
                    &quot;{testimonial.quote}&quot;
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
