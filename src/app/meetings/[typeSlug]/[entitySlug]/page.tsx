import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { cache } from 'react';
import MeetingLoader from '@/components/meeting-loader';
import { adminDb } from '@/lib/firebase-admin';
import { SmartSappLogo } from '@/components/icons';
import type { Meeting } from '@/lib/types';
import { resolveSeoMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ typeSlug: string; entitySlug: string }>;
};

/**
 * Public Meeting Page (Server Component)
 * Dynamic routing handles specific meeting types and their associated entities.
 * Supports both V3 meetingSlug routing and legacy entitySlug routing.
 */

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a1a',
};

// Single source of truth for resolving a meeting by its public slug. Wrapped in
// React.cache so generateMetadata and the page body share one Firestore read
// (previously the same query ran twice per request).
const getMeetingBySlug = cache(async function getMeetingBySlug(slug: string): Promise<Meeting | null> {
  try {
    const meetingsCol = adminDb.collection('meetings');
    // Try meetingSlug first (V3), then entitySlug (legacy)
    let snap = await meetingsCol.where('meetingSlug', '==', slug.toLowerCase()).limit(1).get();
    if (snap.empty) {
      snap = await meetingsCol.where('entitySlug', '==', slug.toLowerCase()).limit(1).get();
    }
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Meeting;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entitySlug } = await params;
  const meeting = await getMeetingBySlug(entitySlug);

  if (!meeting) {
    return resolveSeoMetadata({
      fallback: { title: 'Meeting Session', description: 'Register for an upcoming meeting session.' },
    });
  }

  const typeLabel = meeting.type?.name || 'Meeting';
  const baseTitle = meeting.heroTitle || meeting.brandingName || meeting.entityName || 'Meeting Session';

  return resolveSeoMetadata({
    seo: meeting.seo,
    fallback: {
      title: `${baseTitle} | ${typeLabel}`,
      description:
        meeting.heroDescription ||
        `Join us for an upcoming ${typeLabel}. Register now to secure your spot.`,
      assetImageUrl: meeting.heroImageUrl,
    },
    // Per-meeting logo override doubles as the entity_logo source.
    org: { logoUrl: meeting.logoUrl },
  });
}

export default async function PublicMeetingPage({ params }: Props) {
  const { typeSlug, entitySlug } = await params;

  let orgName = 'SmartSapp';
  try {
    const meeting = await getMeetingBySlug(entitySlug);
    if (meeting) {
      if (meeting.brandingName) {
        orgName = meeting.brandingName;
      } else if (meeting.entityId) {
        const entityDoc = await adminDb.collection('entities').doc(meeting.entityId).get();
        if (entityDoc.exists) {
          orgName = entityDoc.data()?.name || orgName;
        }
      }
    }
  } catch (error) {
    console.error('Error resolving orgName in page.tsx:', error);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <Suspense fallback={null}>
          <MeetingLoader slug={entitySlug} typeSlug={typeSlug} />
        </Suspense>
      </main>
      <footer className="py-8 text-center text-xs text-muted-foreground bg-background border-t border-border/10 font-sans flex flex-col items-center justify-center gap-2">
        <SmartSappLogo className="h-6" />
        <p className="mt-1">Powered by {orgName}</p>
      </footer>
    </div>
  );
}
