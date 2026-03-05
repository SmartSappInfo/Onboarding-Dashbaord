import UsersClient from './UsersClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Access Control',
  description: 'Manage administrative authorization status, profile attributes, and organizational branding.',
};

export default function UsersPage() {
  return <UsersClient />;
}
