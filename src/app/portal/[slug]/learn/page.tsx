/**
 * {{Org_name}} Experience Platform — Course Catalog Route
 *
 * Async Server Component with dynamic OpenGraph metadata for academy catalog.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalCourseCatalogClient from './PortalCourseCatalogClient';

interface CatalogPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Academy Courses | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Courses & Curriculum | ${brandName}`,
    description: `Explore interactive courses, video lessons, financial toolkits, and certification tracks on ${brandName}.`,
    openGraph: {
      title: `Courses & Curriculum — ${brandName}`,
      description: portal.description || `Browse masterclasses and learning tracks on ${brandName}.`,
      images: portal.seo?.ogImage ? [{ url: portal.seo.ogImage }] : undefined,
    },
  };
}

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { slug } = await params;
  return <PortalCourseCatalogClient slug={slug} />;
}
