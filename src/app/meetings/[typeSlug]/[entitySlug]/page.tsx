import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { cache } from 'react';
import MeetingLoader from '@/components/meeting-loader';
import { adminDb } from '@/lib/firebase-admin';
import { SmartSappLogo } from '@/components/icons';
import type { Meeting } from '@/lib/types';
import { resolveSeoMetadata } from '@/lib/seo';
import { getOrgBranding } from '@/lib/org-branding';
import Footer from '@/components/footer';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a1a',
};

type PageProps = {
  params: Promise<{ typeSlug: string; entitySlug: string }>;
  searchParams: Promise<{ embed?: string }>;
};

// Single source of truth for resolving a meeting by its public slug. Wrapped in
// React.cache so generateMetadata and the page body share one Firestore read
// (previously the same query ran twice per request).
const getMeetingBySlug = cache(async function getMeetingBySlug(slug: string): Promise<Meeting | null> {
  try {
    const meetingsCol = adminDb.collection('meetings');
    
    // Step 0: Try direct document ID lookup
    const docSnap = await meetingsCol.doc(slug).get();
    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() } as Meeting;
    }

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

export async function generateMetadata({ params }: { params: Promise<{ typeSlug: string; entitySlug: string }> }): Promise<Metadata> {
  const { typeSlug, entitySlug } = await params;
  const meeting = await getMeetingBySlug(entitySlug);

  if (!meeting) {
    return resolveSeoMetadata({
      fallback: { title: 'Meeting Session', description: 'Register for an upcoming meeting session.' },
      path: `/meetings/${typeSlug}/${entitySlug}`,
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
    path: `/meetings/${typeSlug}/${entitySlug}`,
  });
}

export default async function PublicMeetingPage({ params, searchParams }: PageProps) {
  const { typeSlug, entitySlug } = await params;
  const { embed } = await searchParams;
  const isEmbedded = embed === 'true';

  let orgBranding = null;
  try {
    const meeting = await getMeetingBySlug(entitySlug);
    if (meeting?.organizationId) {
      orgBranding = await getOrgBranding(meeting.organizationId);
    }
  } catch (error) {
    console.error('Error resolving orgBranding in page.tsx:', error);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <Suspense fallback={null}>
          <MeetingLoader slug={entitySlug} typeSlug={typeSlug} />
        </Suspense>
      </main>
      {!isEmbedded && orgBranding?.landingPageFooterEnabled !== false && (
        <Footer orgBranding={orgBranding} />
      )}
    </div>
  );
}
