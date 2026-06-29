import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import RsvpResponseClient from '@/components/rsvp-response-client';
import { notFound } from 'next/navigation';
import { SmartSappLogo } from '@/components/icons';
import { getOrgBranding } from '@/lib/org-branding';
import Footer from '@/components/footer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Meeting RSVP',
  description: 'Update your availability for the upcoming meeting session.',
  robots: { index: false, follow: false },
};

export default async function RsvpRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ typeSlug: string; entitySlug: string }>;
  searchParams: Promise<{ token?: string; response?: string }>;
}) {
  const { typeSlug, entitySlug } = await params;
  const { token, response } = await searchParams;

  if (!token) {
    return notFound();
  }

  // Resolve the meeting based on entitySlug (meetingSlug or entitySlug) and typeSlug
  const meetingsCol = adminDb.collection('meetings');

  // Try meetingSlug query first
  let querySnap = await meetingsCol
    .where('meetingSlug', '==', entitySlug.toLowerCase())
    .get();

  if (querySnap.empty) {
    // Try entitySlug query next
    querySnap = await meetingsCol
      .where('entitySlug', '==', entitySlug.toLowerCase())
      .get();
  }

  if (querySnap.empty) {
    return notFound();
  }

  const allMeetings = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // Filter by meeting type slug
  const filtered = allMeetings.filter((m: any) => {
    const mTypeSlug = m.type?.slug || '';
    return mTypeSlug === typeSlug || (typeSlug === 'parent-engagement' && m.type?.id === 'parent');
  });

  if (filtered.length === 0) {
    return notFound();
  }

  // Pick the best meeting (upcoming/latest)
  const now = new Date();
  const sorted = filtered.sort((a: any, b: any) => {
    const dateA = new Date(a.meetingTime).getTime();
    const dateB = new Date(b.meetingTime).getTime();
    const isAUp = dateA >= now.getTime();
    const isBUp = dateB >= now.getTime();
    if (isAUp && !isBUp) return -1;
    if (!isAUp && isBUp) return 1;
    return Math.abs(dateA - now.getTime()) - Math.abs(dateB - now.getTime());
  });

  const meeting = sorted[0];

  // Verify the registrant token exists
  const registrantsRef = adminDb.collection(`meetings/${meeting.id}/registrants`);
  const tokenQuery = await registrantsRef.where('token', '==', token).limit(1).get();

  if (tokenQuery.empty) {
    return notFound();
  }

  const registrantData = tokenQuery.docs[0].data();
  const rawRsvp = registrantData.rsvpStatus || null;
  const dbResponse =
    rawRsvp === 'going' || rawRsvp === 'not_going' || rawRsvp === 'later' ? rawRsvp : null;
  const initialChoice =
    response === 'going' || response === 'not_going' || response === 'later' ? response : null;

  let orgBranding = null;
  try {
    if (meeting.organizationId) {
      orgBranding = await getOrgBranding(meeting.organizationId);
    }
  } catch (error) {
    console.error('Error resolving orgBranding in respond/page.tsx:', error);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <RsvpResponseClient
          meetingId={meeting.id}
          meetingTitle={meeting.heroTitle || meeting.entityName || 'Meeting Session'}
          meetingTime={meeting.meetingTime}
          meetingLink={meeting.meetingLink || ''}
          typeSlug={typeSlug}
          entitySlug={entitySlug}
          token={token}
          initialResponse={initialChoice}
          dbResponse={dbResponse}
          contactName={registrantData.name || ''}
        />
      </main>
      {orgBranding?.landingPageFooterEnabled !== false && (
        <Footer orgBranding={orgBranding} />
      )}
    </div>
  );
}
