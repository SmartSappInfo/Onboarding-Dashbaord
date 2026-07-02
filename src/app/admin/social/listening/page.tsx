import dynamic from 'next/dynamic';

const ListeningClient = dynamic(
  () => import('./components/ListeningClient'),
  { ssr: false }
);

/**
 * SocialListeningPage
 * Serves the Brand Social Listening console dynamic loaded without SSR.
 */
export default function SocialListeningPage() {
  return <ListeningClient />;
}
