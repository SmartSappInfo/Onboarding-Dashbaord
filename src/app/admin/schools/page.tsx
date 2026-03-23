import SchoolsClient from './SchoolsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schools Directory',
  description: 'Manage institutional profiles, focal persons, and onboarding status across the network.',
};

export default function SchoolsPage() {
  return <SchoolsClient />;
}
