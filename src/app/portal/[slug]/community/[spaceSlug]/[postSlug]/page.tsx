/**
 * {{Org_name}} Experience Platform — Community Post Detail Route
 *
 * Async Server Component with dynamic OpenGraph metadata for discussion threads.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { CommunityService } from '@/lib/services/community-service';
import PortalPostDetailClient from './PortalPostDetailClient';

interface PostDetailPageProps {
  params: Promise<{ slug: string; spaceSlug: string; postSlug: string }>;
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { slug, spaceSlug, postSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Discussion | Experience Platform',
    };
  }

  const space = await CommunityService.getSpaceBySlug(portal.id, spaceSlug);
  const brandName = portal.branding?.brandName || portal.name;

  if (!space) {
    return {
      title: `Discussion | ${brandName}`,
    };
  }

  const post = await CommunityService.getPostBySlug(space.id, postSlug);

  return {
    title: `${post?.title || 'Discussion'} | ${space.name} — ${brandName}`,
    description: post?.content?.substring(0, 160) || `Read discussion on ${brandName}.`,
    openGraph: {
      title: `${post?.title || 'Discussion'} — ${brandName}`,
      description: post?.content?.substring(0, 160) || `Read discussion on ${brandName}.`,
      images: post?.mediaUrls?.[0] ? [{ url: post.mediaUrls[0] }] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { slug, spaceSlug, postSlug } = await params;
  return (
    <PortalPostDetailClient
      slug={slug}
      spaceSlug={spaceSlug}
      postSlug={postSlug}
    />
  );
}
