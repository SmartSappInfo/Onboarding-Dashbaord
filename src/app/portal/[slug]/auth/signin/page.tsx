/**
 * {{Org_name}} Experience Platform — Member Sign In Page
 *
 * Async Server Component resolving portal data and rendering
 * the PortalSignInClient with server-side validation.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalService } from '@/lib/services/portal-service';
import PortalSignInClient from './PortalSignInClient';

interface SignInPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SignInPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Sign In | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Sign In — ${brandName}`,
    description: `Sign in to access your member account and resources at ${brandName}.`,
  };
}

export default async function SignInPage({ params }: SignInPageProps) {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  return <PortalSignInClient portal={portal} slug={slug} />;
}
