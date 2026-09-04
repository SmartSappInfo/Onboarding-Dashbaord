import type { Metadata } from 'next';
import { BackofficeDealGovernanceClient } from './components/BackofficeDealGovernanceClient';

export const metadata: Metadata = {
  title: 'Deal Intelligence Governance | SmartSapp Backoffice',
  description: 'Enterprise control plane for deal health scoring weights, stagnation thresholds, and buyer signal rules.',
};

export default function BackofficeDealIntelligencePage() {
  return <BackofficeDealGovernanceClient />;
}
