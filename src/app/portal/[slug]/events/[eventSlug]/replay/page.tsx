import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { EventService } from '@/lib/services/event-service';
import { PortalEventReplayClient } from './PortalEventReplayClient';

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
    return { title: 'Masterclass Replay | {{Org_name}} Experience' };
  }

  const event = await EventService.getLiveEventBySlug(portal.id, eventSlug);
  const brandName = portal.branding.brandName || portal.name;

  if (!event) {
    return { title: `Replay Not Found | ${brandName}` };
  }

  return {
    title: `Replay: ${event.title} | ${brandName}`,
    description: event.aiSummary || `Watch video replay and AI key takeaways for ${event.title}.`,
  };
}

export default async function PortalEventReplayPage({ params }: PageProps) {
  const { slug, eventSlug } = await params;
  return <PortalEventReplayClient slug={slug} eventSlug={eventSlug} />;
}
