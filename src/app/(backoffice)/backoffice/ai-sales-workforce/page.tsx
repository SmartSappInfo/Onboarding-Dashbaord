import type { Metadata } from 'next';
import BackofficeAiWorkforceClient from './components/BackofficeAiWorkforceClient';

export const metadata: Metadata = {
  title: 'AI Workforce Governance | SmartSapp Backoffice',
  description:
    'No-code platform governance for specialized AI sales agents, emergency autonomous kill switches, confidence cutoffs, and token spend quotas.',
};

export default function BackofficeAiWorkforcePage() {
  return <BackofficeAiWorkforceClient />;
}
