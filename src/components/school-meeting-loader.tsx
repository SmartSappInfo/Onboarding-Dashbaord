'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type { School, Meeting } from '@/lib/types';
import MeetingHero from '@/components/meeting-hero';
import { Skeleton } from '@/components/ui/skeleton';

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

    return <MeetingHero school={school} meeting={meeting} />;
}
