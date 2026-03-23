import VideoEmbed from '@/components/video-embed';

interface HelpSectionProps {
  helpVideos: string[];
}

export default function HelpSection({ helpVideos }: HelpSectionProps) {
  return (
    <section
      id="support"
      className="bg-[#E5F0FF] py-20 text-center md:py-28"
    >
      <div className="container px-6 sm:px-10">
        <div className="grid grid-cols-1 md:grid-cols-6">
          <div className="md:col-span-4 md:col-start-2">
            <h2 className="mb-4 font-headline text-3xl font-bold text-gray-900 md:text-4xl">
              Get Help Instantly
            </h2>
            <div className="mx-auto">
                <p className="mb-6 text-lg text-gray-700">
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
                <p className="mb-6 text-lg text-gray-700">
                We look forward to making it easy for you to be involved with your
                child&apos;s school life.
                </p>
                <p className="text-lg font-semibold text-gray-900">
                SmartSapp Team
                </p>
            </div>

            <h3 className="mb-12 mt-16 font-headline text-2xl font-bold text-gray-900 md:text-3xl">
              Useful Help Videos
            </h3>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {helpVideos.map((url, index) => (
                <VideoEmbed key={index} url={url} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
