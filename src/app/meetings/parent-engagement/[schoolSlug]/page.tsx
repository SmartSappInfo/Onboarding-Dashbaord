'use client';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

interface PageProps {
  params: {
    schoolSlug: string;
  }
}

export default function ParentEngagementMeetingPage({ params }: PageProps) {
  return (
    <>
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={params.schoolSlug} typeSlug="parent-engagement" />
      </main>
      <Footer />
    </>
  );
}
