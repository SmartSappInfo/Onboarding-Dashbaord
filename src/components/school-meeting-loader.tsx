'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type { School, Meeting, MeetingType } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import MeetingHero from '@/components/meeting-hero';
import { Skeleton } from '@/components/ui/skeleton';
import AppDownloadSection from '@/components/app-download-section';
import HelpSection from './help-section';
import BrochureDownloadSection from './brochure-download-section';
import SetupProfileSection from './setup-profile-section';
import TestimonialsSection from './testimonials-section';
import WelcomeSection from './welcome-section';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import CountdownTimer from './countdown-timer';
import JoinMeetingButton from './join-meeting-button';

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
      <HelpSection helpVideos={helpVideos} />
      <TestimonialsSection />
    </>
  )
}

const KickoffLayout = ({ school, meeting }: { school: School, meeting: Meeting }) => {
  return (
    <section className="py-20 md:py-28">
      <div className="container text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Welcome to Your School Kickoff</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-12">{school.name}</p>
        
        <div className="grid md:grid-cols-3 gap-8 text-left mb-12">
            <Card><CardHeader><CardTitle>What This Kickoff Covers</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">An overview of the onboarding process, timelines, and key milestones.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Who Should Attend</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">School administrators, IT staff, and project leads for the SmartSapp implementation.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>What You'll Get</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">A clear action plan, access to resources, and answers to all your initial questions.</p></CardContent></Card>
        </div>

        <div className="my-10">
            <CountdownTimer targetDate={meeting.meetingTime} />
        </div>
        <JoinMeetingButton meetingTime={meeting.meetingTime} meetingLink={meeting.meetingLink} />
      </div>
    </section>
  )
}

const TrainingLayout = ({ school, meeting }: { school: School, meeting: Meeting }) => {
  return (
    <section className="py-20 md:py-28">
      <div className="container text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Staff Training Session</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-12">{school.name}</p>

        <div className="grid md:grid-cols-3 gap-8 text-left mb-12">
            <Card><CardHeader><CardTitle>Learning Objectives</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Master the core features of the SmartSapp admin dashboard and mobile app.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Training Resources</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Access to live guides, video tutorials, and our support documentation.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Agenda</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Session will cover student management, parent communication, and financial tools.</p></CardContent></Card>
        </div>

        <div className="my-10">
            <CountdownTimer targetDate={meeting.meetingTime} />
        </div>
        <JoinMeetingButton meetingTime={meeting.meetingTime} meetingLink={meeting.meetingLink} />
      </div>
    </section>
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

            // 2. Fetch the latest meeting for that school and type
            const meetingsCollection = collection(firestore, 'meetings');
            
            // First, try to find an upcoming meeting
            const upcomingMeetingQuery = query(
              meetingsCollection, 
              where('schoolSlug', '==', schoolSlug),
              where('type.slug', '==', typeSlug),
              where('meetingTime', '>=', new Date().toISOString()),
              orderBy('meetingTime', 'asc'),
              limit(1)
            );
            const upcomingMeetingSnapshot = await getDocs(upcomingMeetingQuery);

            if (!upcomingMeetingSnapshot.empty) {
              const foundMeeting = { ...upcomingMeetingSnapshot.docs[0].data(), id: upcomingMeetingSnapshot.docs[0].id } as Meeting;
              setMeeting(foundMeeting);
            } else {
              // If no upcoming meeting, find the most recent past one
              const pastMeetingQuery = query(
                meetingsCollection,
                where('schoolSlug', '==', schoolSlug),
                where('type.slug', '==', typeSlug),
                orderBy('meetingTime', 'desc'),
                limit(1)
              );
              const pastMeetingSnapshot = await getDocs(pastMeetingQuery);

              if (pastMeetingSnapshot.empty) {
                  setError(`No ${meetingType?.name || 'meeting'} found for this school.`);
              } else {
                  const foundMeeting = { ...pastMeetingSnapshot.docs[0].data(), id: pastMeetingSnapshot.docs[0].id } as Meeting;
                  setMeeting(foundMeeting);
              }
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
        return <div className="container py-20 text-center text-destructive">{error}</div>;
    }

    if (!school || !meeting) {
        return (
            <div className="container py-20 text-center">
                <h1 className="text-4xl font-bold">Meeting Information Unavailable</h1>
                <p className="text-muted-foreground mt-4">The meeting page for this school could not be fully loaded. Please check the name and try again, or contact support.</p>
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
