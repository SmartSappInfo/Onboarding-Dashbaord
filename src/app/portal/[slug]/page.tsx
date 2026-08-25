/**
 * {{Org_name}} Experience Platform — Dynamic Portal Page Route
 *
 * Server Component with dynamic OpenGraph / SEO metadata generation.
 * Conforms to Next.js 15+ async params standard.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import PortalRuntimeClient from './PortalRuntimeClient';

interface PortalPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PortalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Portal Not Found | Experience Platform',
      description: 'The requested experience portal could not be found.',
    };
  }

  const title = portal.seo?.metaTitle || `${portal.name} — ${portal.branding?.brandName || 'Experience Portal'}`;
  const description = portal.seo?.metaDescription || portal.branding?.tagline || portal.description || 'Welcome to our digital experience portal.';
  const ogImage = portal.seo?.ogImage || portal.branding?.coverImageUrl || undefined;

  return {
    title,
    description,
    keywords: portal.seo?.keywords,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: 'website',
    },
    twitter: {
      card: portal.seo?.twitterCard || 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: portal.seo?.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { slug } = await params;
  return <PortalRuntimeClient slug={slug} />;
}
