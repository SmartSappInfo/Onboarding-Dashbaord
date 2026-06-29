import type { Metadata } from 'next';
import SchoolEnrollmentClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('school-enrollment', {
    title: 'School Enrollment — Fill Empty Spots in Your Classrooms | SmartSapp',
    description: 'Whether your enrollment is declining, flat, or growing—our expert training will help you boost your numbers just in time for the upcoming academic year. We guarantee it, or you pay nothing!',
  });
}

export default function SchoolEnrollmentPage() {
  return <SchoolEnrollmentClient />;
}
