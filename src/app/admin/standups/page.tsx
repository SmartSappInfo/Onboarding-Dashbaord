import StandupsClient from './StandupsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Standups & Commitments',
  description: 'Team standups, blocker resolution lifecycle, and commitment carryover tracking.',
};

export default function StandupsPage() {
  return <StandupsClient />;
}
