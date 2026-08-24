import { Metadata } from 'next';
import { AgreementsClient } from './AgreementsClient';

export const metadata: Metadata = {
  title: 'Billing Agreements | SmartSapp Finance',
  description: 'Manage institutional recurring contracts, agreed pricing plans, and automated cycle billing.',
};

export default function BillingAgreementsPage() {
  return <AgreementsClient />;
}
