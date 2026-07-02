import dynamic from 'next/dynamic';

const AnalyticsClient = dynamic(
  () => import('./components/AnalyticsClient'),
  { ssr: false }
);

/**
 * SocialAnalyticsPage
 * Serves the social ROI analytics report dashboard dynamic loaded without SSR.
 */
export default function SocialAnalyticsPage() {
  return <AnalyticsClient />;
}
