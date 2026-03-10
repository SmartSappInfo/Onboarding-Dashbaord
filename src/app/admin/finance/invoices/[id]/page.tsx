import InvoiceStudioClient from './InvoiceStudioClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoice Studio',
  description: 'Adjust line items, apply discounts, and finalize institutional billing records.',
};

export default function InvoiceStudioPage() {
  return <InvoiceStudioClient />;
}
