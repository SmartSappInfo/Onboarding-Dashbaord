import Header from '@/components/header';
import Footer from '@/components/footer';
import MeetingLoader from '@/components/meeting-loader';

/**
 * Public Meeting Page (Server Component)
 * Dynamic routing handles specific meeting types and their associated entities.
 * Supports both V3 meetingSlug routing and legacy entitySlug routing.
 */
export default async function PublicMeetingPage({ params }: { params: Promise<{ typeSlug: string; schoolSlug: string }> }) {
  const { typeSlug, schoolSlug } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <MeetingLoader slug={schoolSlug} typeSlug={typeSlug} />
      </main>
      <Footer />
    </div>
  );
}

