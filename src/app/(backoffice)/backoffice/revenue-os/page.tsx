import type { Metadata } from 'next';
import BackofficeRevenueOsClient from './components/BackofficeRevenueOsClient';

export const metadata: Metadata = {
  title: 'Revenue OS & Simulator Governance | SmartSapp Backoffice',
  description:
    'No-code platform governance for executive revenue simulation bounds, ramp curve models, quota coverage targets, and FER baseline synchronization.',
};

export default function BackofficeRevenueOsPage() {
  return <BackofficeRevenueOsClient />;
}
