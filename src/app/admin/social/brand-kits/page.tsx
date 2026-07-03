'use client';

import dynamic from 'next/dynamic';

const BrandKitClient = dynamic(
  () => import('./components/BrandKitClient'),
  { ssr: false }
);

/**
 * SocialBrandKitsPage
 * Serves the Media Brand Kit and visual poster editor console dynamic loaded.
 */
export default function SocialBrandKitsPage() {
  return <BrandKitClient />;
}
