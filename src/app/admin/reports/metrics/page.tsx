import MetricsClient from './MetricsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Metrics Dashboard',
  description: 'Distinct metrics for entities, workspace memberships, and shared contacts.',
};

export default function MetricsPage() {
  return <MetricsClient />;
}
