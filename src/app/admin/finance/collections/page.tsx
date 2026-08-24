import { Metadata } from 'next';
import { CollectionsClient } from './CollectionsClient';

export const metadata: Metadata = {
  title: 'Debt Collections Pipeline | SmartSapp Finance',
  description: 'Manage active debt collection cases, promise-to-pay commitments, and recovery workflows.',
};

export default function CollectionsPage() {
  return <CollectionsClient />;
}
