/**
 * {{Org_name}} Experience Platform — Member Registration Page
 *
 * Async Server Component resolving portal data and rendering
 * the PortalRegisterClient.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalService } from '@/lib/services/portal-service';
import PortalRegisterClient from './PortalRegisterClient';

interface RegisterPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Create Account | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Create Account — ${brandName}`,
    description: `Register for a free membership account at ${brandName} to unlock articles, downloads, and courses.`,
  };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  return <PortalRegisterClient portal={portal} slug={slug} />;
}
