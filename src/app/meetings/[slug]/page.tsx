import { getSchoolBySlug } from '@/lib/data';
import { notFound } from 'next/navigation';
import MeetingHero from '@/components/meeting-hero';
import type { Metadata, ResolvingMetadata } from 'next';
import Header from '@/components/header';
import Footer from '@/components/footer';

interface SchoolMeetingPageProps {
  params: {
    slug: string;
  }
}

export async function generateMetadata(
  { params }: SchoolMeetingPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const school = await getSchoolBySlug(params.slug);

  if (!school) {
    return {
      title: 'School Not Found',
      description: 'The school you are looking for could not be found.',
    };
  }

  return {
    title: `${school.name} | Onboarding Meeting`,
    description: `Join us for a short onboarding session for ${school.name} parents.`,
  };
}

export default async function SchoolMeetingPage({ params }: SchoolMeetingPageProps) {
  const school = await getSchoolBySlug(params.slug);

  if (!school) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="flex-grow">
        <MeetingHero school={school} />
      </main>
      <Footer />
    </>
  );
}
