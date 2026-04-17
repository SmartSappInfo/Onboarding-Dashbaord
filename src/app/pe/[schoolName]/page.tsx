
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import type { School } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link as LinkIcon } from 'lucide-react';
import JoinMeetingButton from '@/components/join-meeting-button';
import Header from '@/components/header';
import Footer from '@/components/footer';

async function getSchoolBySlug(slug: string): Promise<School | null> {
    try {
        const querySnap = await adminDb.collection('entities').where('slug', '==', slug).limit(1).get();
        if (querySnap.empty) {
            // Fallback: try legacy schools collection for older records
            const legacySnap = await adminDb.collection('schools').where('slug', '==', slug).limit(1).get();
            if (legacySnap.empty) return null;
            return { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() } as School;
        }
        return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() } as School;
    } catch (error) {
        return null;
    }
}

export default async function SchoolOnboardingPage({ params }: { params: Promise<{ entityName: string }> }) {
  const { entityName } = await params;
  const school = await getSchoolBySlug(entityName);

  if (!school) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative flex min-h-[70vh] items-center py-20 text-white md:py-32">
          {school.heroImageUrl && (
            <Image
              src={school.heroImageUrl}
              alt={`${school.name} campus`}
              fill
              className="object-cover"
              data-ai-hint="school campus"
              priority
            />
          )}
          <div className="absolute inset-0 bg-black/60"></div>
          <div className="container relative z-10 px-6 text-center">
            {school.logoUrl && (
              <Image
                src={school.logoUrl}
                alt={`${school.name} logo`}
                width={100}
                height={100}
                className="mx-auto mb-6 rounded-full bg-white p-2 object-contain"
              />
            )}
            <h1 className="mb-2 text-4xl font-black tracking-tight md:text-6xl">{school.name}</h1>
            <p className="mb-8 font-light italic text-gray-200 text-xl md:text-2xl">{school.slogan}</p>
            
            <div className="my-10 max-w-2xl mx-auto">
                <p className="text-sm uppercase font-bold tracking-widest mb-4 opacity-60">Join us for parent engagement</p>
                <JoinMeetingButton entitySlug={school.slug} />
            </div>
          </div>
        </section>

        {/* Intro Video Section */}
        <section className="py-16 text-center md:py-24">
          <div className="container">
            <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Welcome to SmartSapp!</h2>
            <p className="mx-auto mb-10 text-lg text-muted-foreground">
              Watch this short video to see how SmartSapp helps bridge the communication gap between school and home.
            </p>
            <div className="max-w-4xl mx-auto">
                <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
            </div>
          </div>
        </section>

        {/* Download Section */}
        <section className="bg-card py-16 md:py-24">
          <div className="container text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Download the App</h2>
            <p className="mx-auto mb-10 text-lg text-muted-foreground">
              Get the SmartSapp mobile app to stay connected on the go. Available on all major platforms.
            </p>
            <AppStoreButtons />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
