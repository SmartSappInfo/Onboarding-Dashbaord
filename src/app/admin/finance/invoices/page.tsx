import InvoicesClient from './InvoicesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoice Registry',
  description: 'Manage institutional billing records, track payment status, and finalize termly invoices.',
};

export default function InvoicesPage() {
  return <InvoicesClient />;
}
