/**
 * {{Org_name}} Experience Platform — Member Dashboard Route
 *
 * Async Server Component with dynamic metadata for personal student hub.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalMemberDashboardClient from './PortalMemberDashboardClient';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Member Dashboard | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `My Learning Dashboard | ${brandName}`,
    description: `Track your enrolled courses, certificates, downloadable toolkits, and learning progress on ${brandName}.`,
    robots: { index: false, follow: false }, // Private member area
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;
  return <PortalMemberDashboardClient slug={slug} />;
}
