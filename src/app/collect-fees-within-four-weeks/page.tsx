import type { Metadata } from 'next';
import CollectFeesClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('collect-fees-within-four-weeks', {
    title: 'Collect Your Fees in 4 Weeks or use SmartSapp for FREE — SmartSapp',
    description:
      'The #1 automated fee collection solution. Designed to make it super easy for you to collect your fees within 4 weeks ~ Guaranteed!',
  });
}

export default function CollectFeesWithinFourWeeksPage() {
  return <CollectFeesClient />;
}
