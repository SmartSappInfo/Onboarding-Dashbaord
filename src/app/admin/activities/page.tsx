import ActivitiesClient from './ActivitiesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Audit Trail',
  description: 'Comprehensive chronological log of all user actions, system events, and interactions.',
};

// Force dynamic rendering since this page uses authentication and search params
export const dynamic = 'force-dynamic';

export default function ActivitiesPage() {
  return <ActivitiesClient />;
}
