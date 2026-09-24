/**
 * {{Org_name}} Experience Platform — Member Tasks & Deliverables Route
 *
 * Async Server Component with dynamic metadata for the student tasks hub.
 * Conforms to Next.js best practices, async params conventions, and strict typing.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalTasksClient from './PortalTasksClient';

interface TasksPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TasksPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Action Tasks | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Action Tasks & Deliverables | ${brandName}`,
    description: `Complete practical drills, audit sheets, and submit deliverables on ${brandName}.`,
    robots: { index: false, follow: false }, // Private member area
  };
}

export default async function TasksPage({ params }: TasksPageProps) {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  return (
    <PortalTasksClient
      slug={slug}
      initialPortal={portal ? JSON.parse(JSON.stringify(portal)) : null}
    />
  );
}
