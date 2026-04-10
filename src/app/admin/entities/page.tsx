import EntitiesClient from './EntitiesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entities Directory',
  description: 'Manage contacts, entities, and onboarding status across the network.',
};

export default function EntitiesPage() {
  return <EntitiesClient />;
}
