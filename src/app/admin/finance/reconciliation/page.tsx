import { Metadata } from 'next';
import { ReconciliationClient } from './ReconciliationClient';

export const metadata: Metadata = {
  title: 'Payment Gateway Reconciliation | SmartSapp Finance',
  description: 'Reconcile external gateway receipts and bank feeds against sub-ledger allocations.',
};

export default function FinanceReconciliationPage() {
  return <ReconciliationClient />;
}
