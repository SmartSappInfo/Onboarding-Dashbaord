/**
 * {{Org_name}} Experience Platform — Invitation Join Route
 *
 * Async Server Component with dynamic OpenGraph metadata for onboarding.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalJoinClient from './PortalJoinClient';

interface JoinPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: JoinPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Join Portal | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Join ${brandName} | Member Invitation`,
    description: `Accept your invitation to join ${brandName}. Access your courses, learning tracks, and member spaces.`,
    openGraph: {
      title: `Join ${brandName} — Member Invitation`,
      description: portal.description || `Join ${brandName} today.`,
      images: portal.seo?.ogImage ? [{ url: portal.seo.ogImage }] : undefined,
    },
  };
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { slug } = await params;
  return <PortalJoinClient slug={slug} />;
}
