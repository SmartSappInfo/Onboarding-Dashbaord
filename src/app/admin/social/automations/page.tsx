import dynamic from 'next/dynamic';

const AutomationBuilderClient = dynamic(
  () => import('./components/AutomationBuilderClient'),
  { ssr: false }
);

/**
 * SocialAutomationsPage
 * Serves the visual social automation rule flow workspace dynamic loaded.
 */
export default function SocialAutomationsPage() {
  return <AutomationBuilderClient />;
}
