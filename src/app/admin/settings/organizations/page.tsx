import { Metadata } from 'next';
import OrganizationsClient from './OrganizationsClient';

export const metadata: Metadata = {
  title: 'Organizations | SmartSapp',
  description: 'Manage organizations and their settings',
};

export default function OrganizationsPage() {
  return <OrganizationsClient />;
}
