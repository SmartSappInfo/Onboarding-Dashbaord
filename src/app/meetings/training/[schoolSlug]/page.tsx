'use client';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SchoolMeetingLoader from '@/components/school-meeting-loader';
import { useParams } from 'next/navigation';

export default function TrainingMeetingPage() {
  const params = useParams();
  const schoolSlug = params.schoolSlug as string;
  
  return (
    <>
      <Header />
      <main className="flex-grow">
        <SchoolMeetingLoader schoolSlug={schoolSlug} typeSlug="training" />
      </main>
      <Footer />
    </>
  );
}
