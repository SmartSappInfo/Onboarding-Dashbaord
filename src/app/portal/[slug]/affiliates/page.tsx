import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { PortalAffiliateDashboardClient } from './PortalAffiliateDashboardClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return { title: 'Partner Program | {{Org_name}} Experience' };
  }

  const brandName = portal.branding.brandName || portal.name;
  return {
    title: `Partner Program & Affiliates | ${brandName}`,
    description: `Earn recurring commission by referring students and schools to ${brandName}.`,
  };
}

export default async function PortalAffiliatesPage({ params }: PageProps) {
  const { slug } = await params;
  return <PortalAffiliateDashboardClient slug={slug} />;
}
