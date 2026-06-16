import type { Metadata } from 'next';
import SchoolComparisonClient from './components/SchoolComparisonClient';
import { getCustomPageMetadata } from '@/lib/seo-server';

/**
 * @fileOverview Persona Selection Campaign Page (Server Entry).
 * Handles SEO metadata and renders the client-side interactive component.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('campaign/school-comparison', {
    title: 'Is Your School Operating Like School A or School B?',
    description: 'Every parent brings a dream to your gate. Daily processes either protect that dream…Or slowly wear it down. Find out which side your school is on',
    assetImageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1772640713710-quiz-parents-option.webp?alt=media&token=77d85e23-5c11-4dbf-ad0b-babed59c4366',
  });
}

export default function SchoolComparisonPage() {
  return <SchoolComparisonClient />;
}
