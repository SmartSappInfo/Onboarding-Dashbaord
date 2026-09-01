import UsersClient from '../users/UsersClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'People & Access Directory',
  description: 'Manage team members, organization memberships, workspaces, and role access permissions.',
};

export default function PeoplePage() {
  return <UsersClient />;
}
