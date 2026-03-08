
import ReportsClient from './ReportsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Network Intelligence',
  description: 'Cross-regional performance audit and organizational health analytics for the school network.',
};

export default function ReportsPage() {
  return <ReportsClient />;
}
