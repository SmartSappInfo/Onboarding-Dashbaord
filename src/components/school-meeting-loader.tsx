
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';

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

// Corrected relative paths for dynamic imports from src/components/
const ActivityTimeline = dynamic(() => import('../app/admin/components/ActivityTimeline'), {
    loading: () => <div className="p-8 space-y-4"><Skeleton className="h-4 w-32"/><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>,
});

const LogActivityModal = dynamic(() => import('../app/admin/schools/components/LogActivityModal'), { ssr: false });

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

    useEffect(() => {
        if (!firestore || !schoolSlug || !typeSlug) {
            return;
        };

        const fetchData = async () => {
          setIsLoading(true);
          setSchool(null);
          setMeeting(null);
          setError(null);

          try {
            const meetingsCol = collection(firestore, 'meetings');
            // Query by schoolSlug (supports both legacy and new meetings)
            const meetingQuery = query(
                meetingsCol, 
                where('schoolSlug', '==', schoolSlug.toLowerCase())
            );
            const meetingSnapshot = await getDocs(meetingQuery);

            if (meetingSnapshot.empty) {
                setError(`Meeting not found for slug: ${schoolSlug}`);
                setIsLoading(false);
                return;
            }

            const allMeetings = meetingSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
            const meetingsForType = allMeetings.filter(m => {
                const mTypeSlug = m.type?.slug || '';
                return mTypeSlug === typeSlug || (typeSlug === 'parent-engagement' && m.type?.id === 'parent');
            });

            if (meetingsForType.length === 0) {
                setError(`No ${typeSlug} session found for this school.`);
                setIsLoading(false);
                return;
            }

            const now = new Date();
            const sorted = meetingsForType.sort((a, b) => {
                const dateA = new Date(a.meetingTime).getTime();
                const dateB = new Date(b.meetingTime).getTime();
                const isAUpcoming = dateA >= now.getTime();
                const isBUpcoming = dateB >= now.getTime();
                if (isAUpcoming && !isBUpcoming) return -1;
                if (!isAUpcoming && isBUpcoming) return 1;
                return Math.abs(dateA - now.getTime()) - Math.abs(dateB - now.getTime());
            });

            const bestMeeting = sorted[0];
            setMeeting(bestMeeting);

            // Resolve school using entityId first (if available), then fallback to schoolId
            // Requirement 9.5: Support both entityId and schoolSlug for resolution
            if (bestMeeting.entityId) {
                // Try to resolve from entities collection first (migrated contacts)
                const entityRef = doc(firestore, 'entities', bestMeeting.entityId);
                const entitySnap = await getDoc(entityRef);
                
                if (entitySnap.exists()) {
                    // Entity found - use entity data
                    const entityData = entitySnap.data();
                    // For backward compatibility, create a School-like object from entity
                    setSchool({
                        id: bestMeeting.schoolId || bestMeeting.entityId,
                        name: entityData.name,
                        slug: entityData.slug || schoolSlug,
                        logoUrl: entityData.institutionData?.logoUrl,
                        entityId: bestMeeting.entityId,
                        migrationStatus: 'migrated',
                    } as School);
                } else if (bestMeeting.schoolId) {
                    // Entity not found, fallback to school
                    const schoolRef = doc(firestore, 'schools', bestMeeting.schoolId);
                    const schoolSnap = await getDoc(schoolRef);
                    if (schoolSnap.exists()) {
                        setSchool({ id: schoolSnap.id, ...schoolSnap.data() } as School);
                    } else {
                        setError("Contact document could not be resolved.");
                    }
                }
            } else if (bestMeeting.schoolId) {
                // Legacy meeting - use schoolId
                const schoolRef = doc(firestore, 'schools', bestMeeting.schoolId);
                const schoolSnap = await getDoc(schoolRef);

                if (schoolSnap.exists()) {
                    setSchool({ id: schoolSnap.id, ...schoolSnap.data() } as School);
                }
            } else {
                // No entityId or schoolId - fallback to slug lookup
                const schoolsCol = collection(firestore, 'schools');
                const schoolQuery = query(schoolsCol, where('slug', '==', schoolSlug.toLowerCase()), limit(1));
                const schoolSnapshot = await getDocs(schoolQuery);
                if (!schoolSnapshot.empty) {
                    setSchool({ id: schoolSnapshot.docs[0].id, ...schoolSnapshot.docs[0].data() } as School);
                } else {
                    setError("School document could not be resolved.");
                }
            }

          } catch (e: any) {
            console.error("SchoolMeetingLoader: Critical error", e);
            setError("Communication failure with database.");
          } finally {
            setIsLoading(false);
          }
        };

        fetchData();
    }, [firestore, schoolSlug, typeSlug]);
      
    if (isLoading) {
        return (
            <section className="w-full bg-background min-h-screen flex items-center justify-center">
                <MeetingPageSkeleton />
            </section>
        );
    }

    if (error || !school || !meeting) {
        return (
            <div className="container py-20 min-h-screen flex flex-col items-center justify-center">
                <MeetingNotFound />
            </div>
        );
    }

    switch(typeSlug) {
      case 'parent-engagement':
        return <ParentEngagementLayout school={school} meeting={meeting} />;
      case 'kickoff':
        return <KickoffLayout school={school} meeting={meeting} />;
      case 'training':
        return <TrainingLayout school={school} meeting={meeting} />;
      default:
        return <div className="container py-20 text-center text-destructive font-black uppercase tracking-widest">Unsupported Protocol.</div>;
    }
}
