import type { Metadata, Viewport } from 'next';
import Footer from '@/components/footer';
import MeetingLoader from '@/components/meeting-loader';
import { adminDb } from '@/lib/firebase-admin';

type Props = {
  params: Promise<{ typeSlug: string; entitySlug: string }>;
};

/**
 * Public Meeting Page (Server Component)
 * Dynamic routing handles specific meeting types and their associated entities.
 * Supports both V3 meetingSlug routing and legacy entitySlug routing.
 */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a1a',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { typeSlug, entitySlug } = await params;

  try {
    const meetingsCol = adminDb.collection('meetings');

    // Try meetingSlug first (V3), then entitySlug (legacy)
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
      const data = snap.docs[0].data();
      const title = data.heroTitle || data.brandingName || data.entityName || 'Meeting Session';
      const description =
        data.heroDescription ||
        `Join us for an upcoming ${data.type?.name || 'session'}. Register now to secure your spot.`;
      const typeLabel = data.type?.name || 'Meeting';

      return {
        title: `${title} | ${typeLabel}`,
        description,
        openGraph: {
          title: `${title} | ${typeLabel}`,
          description,
          type: 'website',
          images: data.heroImageUrl ? [{ url: data.heroImageUrl }] : [],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | ${typeLabel}`,
          description,
        },
      };
    }
  } catch {
    // Graceful fallback — do not block page render
  }

  return {
    title: 'Meeting Session',
    description: 'Register for an upcoming meeting session.',
  };
}

export default async function PublicMeetingPage({ params }: Props) {
  const { typeSlug, entitySlug } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <MeetingLoader slug={entitySlug} typeSlug={typeSlug} />
      </main>
      <Footer />
    </div>
  );
}
