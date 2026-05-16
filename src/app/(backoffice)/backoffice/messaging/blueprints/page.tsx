import BlueprintsHubClient from './components/BlueprintsHubClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messaging Blueprints — Superadmin',
  description: 'Manage global system messaging blueprints.',
};

export default function BlueprintsPage() {
  return <BlueprintsHubClient />;
}
