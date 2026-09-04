import { Metadata } from 'next';
import BackofficeCoachingGovernanceClient from './components/BackofficeCoachingGovernanceClient';

export const metadata: Metadata = {
  title: 'Coaching Intelligence Governance | SmartSapp Backoffice',
  description:
    'Platform control plane for managing Gong-style scorecard rubrics, AI Buyer practice scenarios, speech dynamics thresholds, and FER provisioning.',
};

export default function BackofficeCoachingPage() {
  return <BackofficeCoachingGovernanceClient />;
}
