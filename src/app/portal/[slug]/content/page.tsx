/**
 * {{Org_name}} Experience Platform — Content Vault & Resource Catalog Route
 *
 * Async Server Component with dynamic OpenGraph metadata generation for the
 * portal's universal content library, document tree, and downloadable toolkits.
 *
 * Rules:
 * - Next.js 15: params is a Promise.
 * - Strictly typed (Zero any / any[] / unknown).
 * - RSC boundary: Fetches metadata on the server, delegates interactive rendering to client.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalContentCatalogClient from './PortalContentCatalogClient';

interface ContentCatalogPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ContentCatalogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Resource Vault | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Resource Vault & Documentation | ${brandName}`,
    description: `Access downloadable financial toolkits, administrative guides, documentation, and expert insights on ${brandName}.`,
    openGraph: {
      title: `Resource Vault & Documentation — ${brandName}`,
      description: portal.description || `Browse knowledge base, spreadsheets, and guides on ${brandName}.`,
      images: portal.seo?.ogImage ? [{ url: portal.seo.ogImage }] : undefined,
    },
  };
}

export default async function ContentCatalogPage({ params }: ContentCatalogPageProps) {
  const { slug } = await params;
  return <PortalContentCatalogClient slug={slug} />;
}
