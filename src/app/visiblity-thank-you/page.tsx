import type { Metadata } from 'next';
import VisibilityThankYouClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('visiblity-thank-you', {
    title: 'Thank You — SmartSapp Visibility Initiative',
    description: 'Congratulations! Your School has secured a seat on the School Visibility and Enrollment Initiative.',
  });
}

export default function VisibilityThankYouPage() {
  return <VisibilityThankYouClient />;
}
