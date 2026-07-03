import dynamic from 'next/dynamic';

const SocialDashboardClient = dynamic(
  () => import('./components/SocialDashboardClient'),
  { ssr: false }
);

/**
 * SocialDashboardPage
 * Serves the primary landing console dashboard for the Social Intelligence module.
 */
export default function SocialDashboardPage() {
  return <SocialDashboardClient />;
}
