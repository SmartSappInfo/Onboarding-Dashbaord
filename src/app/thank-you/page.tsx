import type { Metadata } from 'next';
import ThankYouClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('thank-you', {
    title: 'Thank You — SmartSapp',
    description: 'Your demo request is successfully sent. A product specialist will reach out to you shortly.',
  });
}

export default function ThankYouPage() {
  return <ThankYouClient />;
}
