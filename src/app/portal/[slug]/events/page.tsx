import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { PortalEventsCatalogClient } from './PortalEventsCatalogClient';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return { title: 'Events Directory | {{Org_name}} Experience' };
  }

  const brandName = portal.branding.brandName || portal.name;
  return {
    title: `Live Events, Webinars & Masterclasses | ${brandName}`,
    description: `Browse upcoming live masterclasses, interactive coaching sessions, and recorded replays at ${brandName}.`,
  };
}

export default async function PortalEventsCatalogPage({ params }: PageProps) {
  const { slug } = await params;
  return <PortalEventsCatalogClient slug={slug} />;
}
