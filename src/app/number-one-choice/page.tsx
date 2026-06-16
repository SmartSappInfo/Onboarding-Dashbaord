import type { Metadata } from 'next';
import NumberOneChoiceClient from './client';
import { getCustomPageMetadata } from '@/lib/seo-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getCustomPageMetadata('number-one-choice', {
    title: 'Why parents choose other schools over yours — SmartSapp',
    description: 'Want to make your school the preferred choice for parents in one term? Book a FREE 30-minutes consultation.',
  });
}

export default function NumberOneChoicePage() {
  return <NumberOneChoiceClient />;
}
