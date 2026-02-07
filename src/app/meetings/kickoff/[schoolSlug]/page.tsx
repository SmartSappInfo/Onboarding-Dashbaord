'use client';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

interface PageProps {
  params: {
    schoolSlug: string;
  }
}

export default function KickoffMeetingPage({ params }: PageProps) {
  return (
    <>
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={params.schoolSlug} typeSlug="kickoff" />
      </main>
      <Footer />
    </>
  );
}
