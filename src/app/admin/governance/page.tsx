import * as React from 'react';
import { GovernanceClient } from './GovernanceClient';

export const metadata = {
  title: 'Governance & Security Center | SmartSapp Workforce',
  description: 'Access certification reviews, time-bounded JIT access, Separation of Duties, and session controls',
};

export default function AdminGovernancePage() {
  return <GovernanceClient />;
}
