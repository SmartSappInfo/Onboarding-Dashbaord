import PortalsClient from './PortalsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Public Portals',
  description: 'Centralized registry of live institutional system entry points.',
};

export default function PublicPortalsPage() {
  return <PortalsClient />;
}
