import type { Metadata } from 'next';
import DealIntelligenceClient from './DealIntelligenceClient';

export const metadata: Metadata = {
  title: 'Deal & Buyer Intelligence | SmartSapp Sales Performance',
  description: 'Understand deal risk, capture buyer intent signals, map stakeholder power matrices, and streamline meeting briefings.',
};

export default function DealIntelligencePage() {
  return <DealIntelligenceClient />;
}
