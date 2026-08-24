import { ReceivablesClient } from './ReceivablesClient';

export const metadata = {
  title: 'Accounts Receivable | SmartSapp Finance',
  description: 'Accounts Receivable Command Center, aging buckets, and debt risk intelligence',
};

export default function ReceivablesPage() {
  return <ReceivablesClient />;
}
