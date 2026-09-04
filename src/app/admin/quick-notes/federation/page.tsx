import { Metadata } from 'next';
import { FederationHubView } from '../components/federation/FederationHubView';

export const metadata: Metadata = {
  title: 'Knowledge Federation & Integrations | Company Brain',
  description: 'Manage cross-workspace shared spaces, inbound webhooks, and bulk knowledge migration.',
};

export default function QuickNotesFederationPage() {
  return <FederationHubView />;
}
