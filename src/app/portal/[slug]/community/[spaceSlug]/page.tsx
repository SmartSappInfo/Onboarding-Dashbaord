/**
 * {{Org_name}} Experience Platform — Community Space Channel Route
 *
 * Async Server Component with dynamic OpenGraph metadata for space-filtered feed.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { CommunityService } from '@/lib/services/community-service';
import PortalCommunityClient from '../PortalCommunityClient';

interface SpacePageProps {
  params: Promise<{ slug: string; spaceSlug: string }>;
}

export async function generateMetadata({ params }: SpacePageProps): Promise<Metadata> {
  const { slug, spaceSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Community Space | Experience Platform',
    };
  }

  const space = await CommunityService.getSpaceBySlug(portal.id, spaceSlug);
  const brandName = portal.branding?.brandName || portal.name;

  if (!space) {
    return {
      title: `Space | ${brandName}`,
    };
  }

  return {
    title: `${space.name} | ${brandName}`,
    description: space.description || `Browse #${space.name} discussions on ${brandName}.`,
    openGraph: {
      title: `${space.name} — ${brandName}`,
      description: space.description || `Browse #${space.name} discussions.`,
    },
  };
}

export default async function SpacePage({ params }: SpacePageProps) {
  const { slug, spaceSlug } = await params;
  return <PortalCommunityClient slug={slug} activeSpaceSlug={spaceSlug} />;
}
