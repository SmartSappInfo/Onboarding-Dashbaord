import { getSchoolBySlug } from '@/lib/data';
import { notFound } from 'next/navigation';
import MeetingHero from '@/components/meeting-hero';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Ghana International School | Onboarding Meeting',
    description: 'Join us for a short onboarding session for Ghana International School parents.',
};


export default async function SchoolMeetingPage() {
  const schoolSlug = 'ghana-international-school';
  const school = await getSchoolBySlug(schoolSlug);

  if (!school) {
    notFound();
  }

  return (
    <div>
      <MeetingHero school={school} />
    </div>
  );
}
