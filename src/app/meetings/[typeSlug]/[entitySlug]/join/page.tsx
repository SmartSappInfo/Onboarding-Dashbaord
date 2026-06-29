import type { Metadata } from 'next';
import JoiningPageClient from '@/components/joining-page-client';
import { adminDb } from '@/lib/firebase-admin';
import { SmartSappLogo } from '@/components/icons';
import { getOrgBranding } from '@/lib/org-branding';
import Footer from '@/components/footer';

/**
 * Meeting Joining Page (Waiting Room) — Server Component
 *
 * Accessible at /meetings/[typeSlug]/[entitySlug]/join?token=[registrantToken]
 *
 * This page serves as a "Thank You for Registering" + countdown/waiting room.
 * If no valid token is present, the client component redirects to registration.
 * Attendance is logged ONLY when the user transitions to the actual meeting link.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Meeting Waiting Room',
  description: 'Your registration is confirmed. Prepare to join the session.',
  robots: { index: false, follow: false },
};

export default async function MeetingJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ typeSlug: string; entitySlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { typeSlug, entitySlug } = await params;
  const { token } = await searchParams;

  let orgBranding = null;
  try {
    const meetingsCol = adminDb.collection('meetings');
    let snap = await meetingsCol
      .where('meetingSlug', '==', entitySlug.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await meetingsCol
        .where('entitySlug', '==', entitySlug.toLowerCase())
        .limit(1)
        .get();
    }

    if (!snap.empty) {
      const meetingData = snap.docs[0].data();
      if (meetingData.organizationId) {
        orgBranding = await getOrgBranding(meetingData.organizationId);
      }
    }
  } catch (error) {
    console.error('Error resolving orgBranding in join/page.tsx:', error);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <JoiningPageClient
          typeSlug={typeSlug}
          entitySlug={entitySlug}
          token={token || null}
        />
      </main>
      {orgBranding?.landingPageFooterEnabled !== false && (
        <Footer orgBranding={orgBranding} />
      )}
    </div>
  );
}
