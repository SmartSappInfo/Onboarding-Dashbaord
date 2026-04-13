import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

/**
 * Public Meeting Page (Server Component)
 * Dynamic routing handles specific meeting types and their associated entities.
 */
export default async function PublicMeetingPage({ params }: { params: Promise<{ typeSlug: string; schoolSlug: string }> }) {
  const { typeSlug, schoolSlug } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={schoolSlug} typeSlug={typeSlug} />
      </main>
      <Footer />
    </div>
  );
}
