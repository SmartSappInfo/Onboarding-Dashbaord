/**
 * {{Org_name}} Experience Platform — Community Hub Route
 *
 * Async Server Component with dynamic OpenGraph metadata for community discussions.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalCommunityClient from './PortalCommunityClient';

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Community | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Community Discussions | ${brandName}`,
    description: `Connect, share tuition recovery strategies, and discuss best practices on ${brandName}.`,
    openGraph: {
      title: `Community — ${brandName}`,
      description: portal.description || `Join member discussions on ${brandName}.`,
      images: portal.seo?.ogImage ? [{ url: portal.seo.ogImage }] : undefined,
    },
  };
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { slug } = await params;
  return <PortalCommunityClient slug={slug} />;
}
