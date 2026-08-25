/**
 * {{Org_name}} Experience Platform — Backwards Compatible /p/portal/[slug] Route
 *
 * Delegates directly to the dynamic PortalRuntimeClient.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalRuntimeClient from '@/app/portal/[slug]/PortalRuntimeClient';

interface LegacyPortalPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: LegacyPortalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Portal Not Found | Experience Platform',
    };
  }

  return {
    title: portal.seo?.metaTitle || `${portal.name} | Experience Platform`,
    description: portal.seo?.metaDescription || portal.description,
  };
}

export default async function LegacyPortalPage({ params }: LegacyPortalPageProps) {
  const { slug } = await params;
  return <PortalRuntimeClient slug={slug} />;
}
