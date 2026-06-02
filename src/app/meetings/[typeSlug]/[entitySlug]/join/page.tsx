import type { Metadata } from 'next';
import JoiningPageClient from '@/components/joining-page-client';
import { adminDb } from '@/lib/firebase-admin';
import { SmartSappLogo } from '@/components/icons';

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

  let orgName = 'SmartSapp';
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
      if (meetingData.brandingName) {
        orgName = meetingData.brandingName;
      } else if (meetingData.entityId) {
        const entityDoc = await adminDb.collection('entities').doc(meetingData.entityId).get();
        if (entityDoc.exists) {
          orgName = entityDoc.data()?.name || orgName;
        }
      }
    }
  } catch (error) {
    console.error('Error resolving orgName in join/page.tsx:', error);
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
      <footer className="py-8 text-center text-xs text-muted-foreground bg-background border-t border-border/10 font-sans flex flex-col items-center justify-center gap-2">
        <SmartSappLogo className="h-6" />
        <p className="mt-1">Powered by {orgName}</p>
      </footer>
    </div>
  );
}
