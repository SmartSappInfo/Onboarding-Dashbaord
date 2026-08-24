import { Metadata } from 'next';
import { FinancialApprovalsClient } from './FinancialApprovalsClient';

export const metadata: Metadata = {
  title: 'Financial Approvals & Governance | SmartSapp Finance',
  description: 'Managerial signoff queue for high-value refunds, write-offs, and voiding operations.',
};

export default function FinancialApprovalsPage() {
  return <FinancialApprovalsClient />;
}
