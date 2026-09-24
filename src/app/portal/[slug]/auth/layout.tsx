/**
 * {{Org_name}} Experience Platform — Branded Dedicated Auth Layout
 *
 * Async Server Component resolving portal brand data and rendering
 * the PortalAuthLayoutClient theme provider shell.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalService } from '@/lib/services/portal-service';
import PortalAuthLayoutClient from './PortalAuthLayoutClient';

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Member Authentication | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Sign In or Join — ${brandName}`,
    description: `Access your member dashboard, exclusive toolkits, and premium courses in ${brandName}.`,
    openGraph: {
      title: `Sign In — ${brandName}`,
      description: portal.description || `Member access portal for ${brandName}.`,
      images: portal.seo?.ogImage ? [{ url: portal.seo.ogImage }] : undefined,
    },
  };
}

export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  return (
    <PortalAuthLayoutClient portal={portal} slug={slug}>
      {children}
    </PortalAuthLayoutClient>
  );
}
