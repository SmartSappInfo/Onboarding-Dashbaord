/**
 * {{Org_name}} Experience Platform — Dynamic Content Reader Route
 *
 * Async Server Component with dynamic OpenGraph / SEO metadata generation
 * for Articles, Documentation pages, Lessons, and Resources.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { ContentService } from '@/lib/services/content-service';
import type { ContentItemType } from '@/lib/types/content';
import PortalContentReaderClient from './PortalContentReaderClient';

interface ContentReaderPageProps {
  params: Promise<{
    slug: string;
    type: string;
    itemSlug: string;
  }>;
}

export async function generateMetadata({ params }: ContentReaderPageProps): Promise<Metadata> {
  const { slug, type, itemSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Content Not Found | Experience Platform',
    };
  }

  const item = await ContentService.getContentItemBySlug(
    portal.id,
    type as ContentItemType,
    itemSlug
  );

  if (!item) {
    return {
      title: `Content Not Found | ${portal.name}`,
    };
  }

  const title = item.seo?.metaTitle || `${item.title} — ${portal.branding?.brandName || portal.name}`;
  const description = item.seo?.metaDescription || item.summary || portal.description;
  const ogImage = item.seo?.ogImage || item.media?.thumbnailUrl || portal.seo?.ogImage || undefined;

  return {
    title,
    description,
    keywords: item.seo?.keywords || portal.seo?.keywords,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: 'article',
    },
    twitter: {
      card: item.seo?.twitterCard || 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: item.seo?.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function ContentReaderPage({ params }: ContentReaderPageProps) {
  const { slug, type, itemSlug } = await params;
  return <PortalContentReaderClient slug={slug} type={type} itemSlug={itemSlug} />;
}
