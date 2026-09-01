/**
 * ARCHITECTURE:
 * Multi-Platform Publishing Center Page (Phase 8)
 * 
 * Server Component fetching publication records and connected social media channels.
 */

import {
  listPublicationHistoryAction,
  listConnectedChannelsAction,
} from '@/app/actions/creative-publishing-actions';
import { PublishingClient } from './PublishingClient';

export default async function PublishingPage() {
  const workspaceId = 'default-workspace';

  const [historyRes, channelsRes] = await Promise.all([
    listPublicationHistoryAction(workspaceId),
    listConnectedChannelsAction(workspaceId),
  ]);

  const publications = historyRes.success && historyRes.data ? historyRes.data : [];
  const channels = channelsRes.success && channelsRes.data ? channelsRes.data : [];

  return (
    <PublishingClient
      initialPublications={publications}
      initialChannels={channels}
    />
  );
}
