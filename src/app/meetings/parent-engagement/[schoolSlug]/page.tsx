
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

/**
 * Parent Engagement Meeting Page (Server Component)
 * Next.js 15 requires params to be awaited.
 */
export default async function ParentEngagementMeetingPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={schoolSlug} typeSlug="parent-engagement" />
      </main>
      <Footer />
    </div>
  );
}
