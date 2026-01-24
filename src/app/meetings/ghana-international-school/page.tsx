'use client';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

export default function SchoolMeetingPage() {
  const schoolSlug = 'ghana-international-school';
  
  return (
    <>
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader slug={schoolSlug} />
      </main>
      <Footer />
    </>
  );
}
