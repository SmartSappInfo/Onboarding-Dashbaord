import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { EventService } from '@/lib/services/event-service';
import { PortalEventDetailClient } from './PortalEventDetailClient';

interface PageProps {
  params: Promise<{
    slug: string;
    eventSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, eventSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return { title: 'Live Session | {{Org_name}} Experience' };
  }

  const event = await EventService.getLiveEventBySlug(portal.id, eventSlug);
  const brandName = portal.branding.brandName || portal.name;

  if (!event) {
    return { title: `Event Not Found | ${brandName}` };
  }

  return {
    title: `${event.title} with ${event.instructorName} | ${brandName}`,
    description: event.description || `Register for ${event.title} live masterclass on ${brandName}.`,
  };
}

export default async function PortalEventDetailPage({ params }: PageProps) {
  const { slug, eventSlug } = await params;
  return <PortalEventDetailClient slug={slug} eventSlug={eventSlug} />;
}
