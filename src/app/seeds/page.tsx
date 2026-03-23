
import { Metadata } from 'next';
import SeedsClient from './SeedsClient';

export const metadata: Metadata = {
  title: 'System Seeding Hub',
  description: 'Institutional data initialization and environment reset tools.',
};

export default function SeedsPage() {
  return <SeedsClient />;
}
