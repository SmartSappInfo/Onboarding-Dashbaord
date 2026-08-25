/**
 * {{Org_name}} Experience Platform — Portal Studio Page
 *
 * Async server component adhering to Next.js 15+ async params convention.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import PortalStudioClient from './PortalStudioClient';

interface PortalStudioPageProps {
  params: Promise<{
    portalId: string;
  }>;
}

export async function generateMetadata({ params }: PortalStudioPageProps): Promise<Metadata> {
  const { portalId } = await params;
  return {
    title: `Portal Studio | Experience Platform`,
    description: `Configure Experience Portal ${portalId}`,
  };
}

export default async function PortalStudioPage({ params }: PortalStudioPageProps) {
  const { portalId } = await params;
  return <PortalStudioClient portalId={portalId} />;
}
