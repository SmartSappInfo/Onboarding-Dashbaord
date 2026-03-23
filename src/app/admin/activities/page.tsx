import ActivitiesClient from './ActivitiesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Audit Trail',
  description: 'Comprehensive chronological log of all user actions, system events, and interactions.',
};

export default function ActivitiesPage() {
  return <ActivitiesClient />;
}
