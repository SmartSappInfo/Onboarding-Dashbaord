'use client';
import { useParams } from 'next/navigation';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';

export default function SchoolMeetingPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <>
      <Header />
      <main className="flex-grow">
        {/* Render loader only when slug is available */}
        {slug && <SchoolMeetingLoader slug={slug} />}
      </main>
      <Footer />
    </>
  );
}
