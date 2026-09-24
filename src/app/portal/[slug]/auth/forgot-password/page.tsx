/**
 * {{Org_name}} Experience Platform — Member Forgot Password Page
 *
 * Async Server Component resolving portal data and rendering
 * the PortalForgotPasswordClient.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalService } from '@/lib/services/portal-service';
import PortalForgotPasswordClient from './PortalForgotPasswordClient';

interface ForgotPasswordPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Reset Password | Experience Platform',
    };
  }

  const brandName = portal.branding?.brandName || portal.name;

  return {
    title: `Reset Password — ${brandName}`,
    description: `Reset your member account password for ${brandName}.`,
  };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  return <PortalForgotPasswordClient portal={portal} slug={slug} />;
}
