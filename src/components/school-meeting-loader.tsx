'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type { School, Meeting } from '@/lib/types';
import MeetingHero from '@/components/meeting-hero';
import { Skeleton } from '@/components/ui/skeleton';
import VideoEmbed from '@/components/video-embed';
import AppStoreButtons from '@/components/app-store-buttons';
import { Card, CardContent } from '@/components/ui/card';

function MeetingPageSkeleton() {
  return (
    <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-10 md:grid-cols-2 md:py-20 lg:gap-20">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <div className="mb-6 flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="mt-2 h-5 w-32" />
                </div>
            </div>
            <Skeleton className="h-12 w-full max-w-lg" />
            <Skeleton className="mt-4 h-6 w-full max-w-md" />
            <Skeleton className="mt-4 h-6 w-full max-w-sm" />
            <div className="my-10 w-full max-w-lg">
                <div className="grid grid-cols-4 gap-2 sm:gap-5 justify-center">
                    <Skeleton className="h-24 w-24 rounded-lg" />
                    <Skeleton className="h-24 w-24 rounded-lg" />
                    <Skeleton className="h-24 w-24 rounded-lg" />
                    <Skeleton className="h-24 w-24 rounded-lg" />
                </div>
            </div>
            <Skeleton className="h-16 w-48 rounded-full" />
        </div>
        <div className="relative h-80 w-full rounded-xl md:h-[500px] order-first md:order-last">
            <Skeleton className="h-full w-full rounded-xl" />
        </div>
    </div>
  )
}

interface SchoolMeetingLoaderProps {
    slug: string;
}

export default function SchoolMeetingLoader({ slug }: SchoolMeetingLoaderProps) {
    const firestore = useFirestore();
    const [school, setSchool] = useState<School | null>(null);
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (school) {
          document.title = `${school.name} | Onboarding Meeting`;
        }
    }, [school]);

    useEffect(() => {
        if (!firestore || !slug) {
            setIsLoading(false);
            return;
        };

        const fetchSchoolAndMeeting = async () => {
          setIsLoading(true);
          setSchool(null);
          setMeeting(null);
          setError(null);

          try {
            // 1. Fetch the school by slug
            const schoolsCollection = collection(firestore, 'schools');
            const schoolQuery = query(schoolsCollection, where('slug', '==', slug));
            const schoolSnapshot = await getDocs(schoolQuery);

            if (schoolSnapshot.empty) {
              setError("School not found.");
              setIsLoading(false);
              return;
            }
            
            const foundSchool = { ...schoolSnapshot.docs[0].data(), id: schoolSnapshot.docs[0].id } as School;
            setSchool(foundSchool);

            // 2. Fetch the latest meeting for that school
            const meetingsCollection = collection(firestore, 'meetings');
            const meetingQuery = query(
              meetingsCollection, 
              where('schoolSlug', '==', slug),
              orderBy('meetingTime', 'desc'),
              limit(1)
            );
            const meetingSnapshot = await getDocs(meetingQuery);

            if (meetingSnapshot.empty) {
              setError("No upcoming meeting found for this school.");
            } else {
              const foundMeeting = { ...meetingSnapshot.docs[0].data(), id: meetingSnapshot.docs[0].id } as Meeting;
              setMeeting(foundMeeting);
            }

          } catch (e: any) {
            console.error(e);
            setError("Failed to load school or meeting data. Please try again later.");
          } finally {
            setIsLoading(false);
          }
        };

        fetchSchoolAndMeeting();
    }, [firestore, slug]);
      
    if (isLoading) {
        return (
            <section className="w-full bg-background">
                <MeetingPageSkeleton />
            </section>
        );
    }

    if (error) {
        return <div className="container mx-auto py-20 text-center text-destructive">{error}</div>;
    }

    if (!school || !meeting) {
        return (
            <div className="container mx-auto py-20 text-center">
                <h1 className="text-4xl font-bold">Meeting Information Unavailable</h1>
                <p className="text-muted-foreground mt-4">The meeting page for this school could not be fully loaded. Please check the name and try again, or contact support.</p>
            </div>
        )
    }

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
        <>
            <MeetingHero school={school} meeting={meeting} />
            <div className="bg-white text-gray-800">
                <div className="space-y-20 py-20 md:space-y-28 md:py-28">
                    <section className="container mx-auto px-6 text-center">
                        <h1 className="mb-6 font-headline text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl lg:text-6xl">
                            Welcome to the SmartSapp Family
                        </h1>
                        <p className="mx-auto mb-4 max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl">
                            Your child's school has signed up on SmartSapp.
                            <br />
                            Here is a quick video to help you understand what it means for you as a parent.
                        </p>
                        <p className="mx-auto mb-10 max-w-3xl text-lg font-semibold text-gray-800">
                            Please watch the full video. It's super important!
                        </p>
                        <div className="mt-16">
                            <VideoEmbed url="https://youtu.be/M6MUlDkfZOg" />
                        </div>
                    </section>

                    {/* Section 1: Download */}
                    <section id="download" className="container mx-auto px-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                        1
                    </div>
                    <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl text-gray-900">
                        Want to get Started?
                    </h2>
                    <p className="mx-auto mb-6 max-w-2xl text-lg text-gray-600">
                        You can download SmartSapp below by clicking the icon that applies
                        to your phone type
                    </p>
                    <p className="mb-10">
                        <a
                        href="#download-links"
                        className="font-semibold text-primary hover:underline"
                        >
                        Click To Download Now!
                        </a>
                    </p>
                    <div id="download-links" className="flex justify-center">
                        <AppStoreButtons />
                    </div>
                    </section>

                    {/* Section 2: Setup */}
                    <section id="setup-profile" className="container mx-auto px-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                        2
                    </div>
                    <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl text-gray-900">
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
                    </section>

                    {/* Section 3: Support & Help Videos */}
                    <section id="support" className="container mx-auto px-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                        3
                    </div>
                    <div className="mx-auto max-w-3xl">
                        <p className="mb-6 text-lg text-gray-600">
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
                        <p className="mb-6 text-lg text-gray-600">
                        We look forward to making it easy for you to be involved with your
                        child&apos;s school life.
                        </p>
                        <p className="text-lg font-semibold text-gray-800">
                        SmartSapp Team
                        </p>
                    </div>

                    <h2 className="mb-12 mt-16 font-headline text-3xl font-bold md:text-4xl text-gray-900">
                        Useful Help Videos
                    </h2>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {helpVideos.map((url, index) => (
                        <VideoEmbed key={index} url={url} />
                        ))}
                    </div>
                    </section>

                    {/* Section 4: Testimonials */}
                    <section id="testimonials" className="container mx-auto px-6 text-center">
                    <h2 className="mb-4 font-headline text-3xl font-bold tracking-tight md:text-4xl text-gray-900">
                        Why Parents and Schools are going
                        <br />
                        Wild over SmartSapp
                    </h2>
                    <p className="mx-auto mb-6 max-w-2xl text-lg text-gray-600">
                        Watch these testimonials to see how parents are ensuring their
                        child's security with SmartSapp
                    </p>
                    <p className="mb-12 text-lg font-semibold text-gray-800">
                        👇 Click To Watch These Videos. It&apos;s Super Important👇
                    </p>

                    <div className="grid grid-cols-1 gap-x-8 gap-y-12 text-left md:grid-cols-2">
                        {testimonials.map((testimonial, index) => (
                        <Card
                            key={index}
                            className="overflow-hidden shadow-lg bg-card text-card-foreground"
                        >
                            <VideoEmbed url={testimonial.videoUrl} />
                            <CardContent className="p-6">
                            <p className="font-quote italic text-gray-500">
                                &quot;{testimonial.quote}&quot;
                            </p>
                            </CardContent>
                        </Card>
                        ))}
                    </div>
                    </section>
                </div>
            </div>
        </>
    );
}
