
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

/**
 * Training Meeting Page (Server Component)
 */
export default async function TrainingMeetingPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={schoolSlug} typeSlug="training" />
      </main>
      <Footer />
    </div>
  );
}
