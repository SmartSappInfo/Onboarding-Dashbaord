import * as React from 'react';
import { WorkforceCrmClient } from './WorkforceCrmClient';

export const metadata = {
  title: 'CRM-Aware Workforce Allocation | SmartSapp Workforce',
  description: 'Manage sales rep portfolio allocation, pipeline capacity, and deterministic ownership transfers',
};

export default function AdminWorkforceCrmPage() {
  return <WorkforceCrmClient />;
}
