import { Metadata } from 'next';
import BackofficeSalesTeamsClient from './components/BackofficeSalesTeamsClient';

export const metadata: Metadata = {
  title: 'Sales Teams & Capacity Governance | SmartSapp Backoffice',
  description:
    'Platform control plane for managing sales teams, representative capacity thresholds, and executing FER migration protocols.',
};

export default function BackofficeSalesTeamsPage() {
  return <BackofficeSalesTeamsClient />;
}
