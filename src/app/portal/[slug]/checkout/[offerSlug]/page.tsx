import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { CommerceService } from '@/lib/services/commerce-service';
import { PortalCheckoutClient } from './PortalCheckoutClient';

interface PageProps {
  params: Promise<{
    slug: string;
    offerSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, offerSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return { title: 'Checkout | {{Org_name}} Experience' };
  }

  const offer = await CommerceService.getOfferBySlug(portal.id, offerSlug);
  const brandName = portal.branding.brandName || portal.name;

  if (!offer) {
    return { title: `Checkout | ${brandName}` };
  }

  return {
    title: `Checkout: ${offer.title} | ${brandName}`,
    description: offer.description || `Complete your order for ${offer.title} at ${brandName}.`,
  };
}

export default async function PortalCheckoutPage({ params }: PageProps) {
  const { slug, offerSlug } = await params;
  return <PortalCheckoutClient slug={slug} offerSlug={offerSlug} />;
}
