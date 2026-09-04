import type { Metadata } from 'next';
import BackofficeOrchestrationClient from './components/BackofficeOrchestrationClient';

export const metadata: Metadata = {
  title: 'Sales Orchestration Governance | SmartSapp Backoffice',
  description:
    'No-code governance control plane for sales plays, intelligent workload routing caps, SLA breach matrix, and emergency circuit breakers.',
};

export default function BackofficeOrchestrationPage() {
  return <BackofficeOrchestrationClient />;
}
