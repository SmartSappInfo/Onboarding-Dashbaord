import type { Metadata } from 'next';
import AiSalesWorkforceClient from './AiSalesWorkforceClient';

export const metadata: Metadata = {
  title: 'AI Sales Workforce | SmartSapp Sales Performance',
  description:
    'Specialized autonomous sales agents, next-best-action prioritization, human-in-the-loop approvals, and automated CRM data hygiene.',
};

export default function AiSalesWorkforcePage() {
  return <AiSalesWorkforceClient />;
}
