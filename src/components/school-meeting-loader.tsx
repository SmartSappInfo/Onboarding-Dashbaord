'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type { School, Meeting } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import MeetingHero from '@/components/meeting-hero';
import { Skeleton } from '@/components/ui/skeleton';
import AppDownloadSection from '@/components/app-download-section';
import HelpSection from './help-section';
import BrochureDownloadSection from './brochure-download-section';
import SetupProfileSection from './setup-profile-section';
import TestimonialsSection from './testimonials-section';
import WelcomeSection from './welcome-section';
import KickoffMeetingHero from './kickoff-meeting-hero';
import TrainingMeetingHero from './training-meeting-hero';
import MeetingNotFound from './meeting-not-found';
import RecordingSection from './recording-section';

function MeetingPageSkeleton() {
  return (
    <div className="container grid grid-cols-1 items-center gap-12 py-10 md:py-20 lg:gap-20">
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
        <div className="relative flex items-center justify-center min-h-[400px] w-full order-first md:order-last">
            <div className="relative flex items-center justify-center">
                <Skeleton className="relative w-[640px] h-[640px] object-contain" />
            </div>
        </div>
    </div>
  )
}

const ParentEngagementLayout = ({ school, meeting }: { school: School, meeting: Meeting }) => {
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
      <MeetingHero school={school} meeting={meeting} />
      <WelcomeSection />
      <AppDownloadSection />
      <SetupProfileSection />
      {meeting.brochureUrl && <BrochureDownloadSection brochureUrl={meeting.brochureUrl} />}
      {meeting.recordingUrl && <RecordingSection recordingUrl={meeting.recordingUrl} />}
      <HelpSection helpVideos={helpVideos} />
      <TestimonialsSection />
    </>
  )
}

const KickoffLayout = ({ school, meeting }: { school: School, meeting: Meeting }) => {
  return (
    <>
      <KickoffMeetingHero school={school} meeting={meeting} />
      {meeting.recordingUrl && <RecordingSection recordingUrl={meeting.recordingUrl} />}
    </>
  )
}

const TrainingLayout = ({ school, meeting }: { school: School, meeting: Meeting }) => {
  return (
    <>
      <TrainingMeetingHero school={school} meeting={meeting} />
      {meeting.recordingUrl && <RecordingSection recordingUrl={meeting.recordingUrl} />}
    </>
  )
}

interface SchoolMeetingLoaderProps {
    schoolSlug: string;
    typeSlug: string;
}

export default function SchoolMeetingLoader({ schoolSlug, typeSlug }: SchoolMeetingLoaderProps) {
    const firestore = useFirestore();
    const [school, setSchool] = useState<School | null>(null);
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const meetingType = MEETING_TYPES.find(t => t.slug === typeSlug);

    useEffect(() => {
        if (school && meetingType) {
          document.title = `${meetingType.name}: ${school.name} | Onboarding Meeting`;
        }
    }, [school, meetingType]);

    useEffect(() => {
        if (!firestore || !schoolSlug || !typeSlug) {
            setIsLoading(false);
            setError("Required information is missing.");
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
            const schoolQuery = query(schoolsCollection, where('slug', '==', schoolSlug), limit(1));
            const schoolSnapshot = await getDocs(schoolQuery);

            if (schoolSnapshot.empty) {
              setError("School not found.");
              setIsLoading(false);
              return;
            }
            
            const foundSchool = { ...schoolSnapshot.docs[0].data(), id: schoolSnapshot.docs[0].id } as School;
            setSchool(foundSchool);

            // 2. Fetch all meetings for that school
            const meetingsCollection = collection(firestore, 'meetings');
            const allMeetingsForSchoolQuery = query(
              meetingsCollection,
              where('schoolId', '==', foundSchool.id)
            );
            const allMeetingsSnapshot = await getDocs(allMeetingsForSchoolQuery);

            if (allMeetingsSnapshot.empty) {
                setError(`No meetings found for this school.`);
                setIsLoading(false);
                return;
            }

            // 3. Filter and sort on the client-side
            const allMeetings = allMeetingsSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
            
            const meetingsForType = allMeetings.filter(m => m.type.slug === typeSlug);

            if (meetingsForType.length === 0) {
                setError(`No ${meetingType?.name || 'meeting'} found for this school.`);
                setIsLoading(false);
                return;
            }
            
            // 4. Find the best meeting: latest upcoming, or latest past if none are upcoming.
            const now = new Date();
            const upcomingMeetings = meetingsForType
                .filter(m => new Date(m.meetingTime) >= now)
                .sort((a,b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime());
            
            const pastMeetings = meetingsForType
                .filter(m => new Date(m.meetingTime) < now)
                .sort((a,b) => new Date(b.meetingTime).getTime() - new Date(a.meetingTime).getTime());

            const bestMeeting = upcomingMeetings[0] || pastMeetings[0];

            if (bestMeeting) {
              setMeeting(bestMeeting);
            } else {
              setError(`No suitable meeting could be identified.`);
            }

          } catch (e: any) {
            console.error(e);
            setError("Failed to load school or meeting data. Please try again later.");
          } finally {
            setIsLoading(false);
          }
        };

        fetchSchoolAndMeeting();
    }, [firestore, schoolSlug, typeSlug, meetingType]);
      
    if (isLoading) {
        return (
            <section className="w-full bg-background">
                <MeetingPageSkeleton />
            </section>
        );
    }

    if (error) {
        return (
            <div className="container py-20">
                <MeetingNotFound />
            </div>
        );
    }

    if (!school || !meeting) {
        return (
            <div className="container py-20">
                <MeetingNotFound />
            </div>
        )
    }

    switch(typeSlug) {
      case 'parent-engagement':
        return <ParentEngagementLayout school={school} meeting={meeting} />;
      case 'kickoff':
        return <KickoffLayout school={school} meeting={meeting} />;
      case 'training':
        return <TrainingLayout school={school} meeting={meeting} />;
      default:
        return <div className="container py-20 text-center text-destructive">Invalid meeting type.</div>;
    }
}
