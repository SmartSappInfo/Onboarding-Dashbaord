import EntitiesClient from './EntitiesClient';

// Note: Metadata cannot be dynamic in Next.js App Router
// The actual page title is set dynamically in EntitiesClient using the terminology hook
export const metadata = {
  title: 'Entities Directory',
  description: 'Manage contacts, entities, and onboarding status across the network.',
};

export default function EntitiesPage() {
  return <EntitiesClient />;
}
