import type { Metadata } from 'next';
import CollectingFeesClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('collecting-fees-without-delays-and-parental-confrontations', {
    title: 'How we collect fees without delays and parental confrontations — SmartSapp',
    description: 'Fee collection used to bring stress. SmartSapp changed it. No gate issues. Payments feel smooth. Book a FREE 30-minutes consultation.',
  });
}

export default function CollectingFeesPage() {
  return <CollectingFeesClient />;
}
