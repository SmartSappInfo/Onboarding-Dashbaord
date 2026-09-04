import type { Metadata } from 'next';
import { BackofficeAttributionClient } from './components/BackofficeAttributionClient';

export const metadata: Metadata = {
  title: 'Revenue Attribution Governance | SmartSapp Backoffice',
  description:
    'Enterprise control plane for multi-touch attribution models, custom stage weighting, Monte Carlo simulation parameters, and FER migration.',
};

export default function BackofficeRevenueAttributionPage() {
  return <BackofficeAttributionClient />;
}
