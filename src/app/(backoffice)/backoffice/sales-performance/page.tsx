import { Metadata } from 'next';
import BackofficePolicyGovernanceClient from './components/BackofficePolicyGovernanceClient';

export const metadata: Metadata = {
  title: 'Performance Policies Governance | SmartSapp Backoffice',
  description:
    'Platform control plane for inspecting multi-tenant performance policies, auditing version rollbacks, and resetting system baselines.',
};

export default function BackofficeSalesPerformancePage() {
  return <BackofficePolicyGovernanceClient />;
}
