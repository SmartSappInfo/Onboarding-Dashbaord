import { BackofficeIdentityClient } from './BackofficeIdentityClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Identity & Access Control Plane',
  description: 'Super-administrative inspection of cross-tenant Identity 2.0 graphs, canonical models, and dual-write reconciliation.',
};

export default function BackofficeIdentityPage() {
  return <BackofficeIdentityClient />;
}
