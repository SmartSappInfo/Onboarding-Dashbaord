import type { Metadata } from 'next';
import SchoolVisibilityClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('school-visibility-and-enrollment-initiative', {
    title: 'SmartSapp - School Visibility & Enrollment Initiative',
    description: "A special initiative to boost your school's visibility, reputation, and enrollment — at no extra workload for your team.",
  });
}

export default function SchoolVisibilityPage() {
  return <SchoolVisibilityClient />;
}
