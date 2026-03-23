
import PeriodsClient from './PeriodsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing Cycles',
  description: 'Manage institutional invoicing windows, term dates, and payment due targets.',
};

export default function PeriodsPage() {
  return <PeriodsClient />;
}
