'use client';

import dynamic from 'next/dynamic';

const SocialCalendarClient = dynamic(
  () => import('./components/SocialCalendarClient'),
  { ssr: false }
);

/**
 * SocialCalendarPage
 * Serves the Content Calendar view segment dynamic loaded without SSR.
 */
export default function SocialCalendarPage() {
  return <SocialCalendarClient />;
}
