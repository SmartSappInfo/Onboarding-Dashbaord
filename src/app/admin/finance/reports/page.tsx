import { Metadata } from 'next';
import { FinanceReportsClient } from './FinanceReportsClient';

export const metadata: Metadata = {
  title: 'Executive Financial Reports & Analytics | SmartSapp Finance',
  description: 'Executive revenue telemetry, cashflow trends, aging exposure, and collector performance.',
};

export default function FinanceReportsPage() {
  return <FinanceReportsClient />;
}
