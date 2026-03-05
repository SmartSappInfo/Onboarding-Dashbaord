import ProfileClient from './ProfileClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Profile',
  description: 'Update your personal identity, contact details, and platform notification preferences.',
};

export default function ProfilePage() {
  return <ProfileClient />;
}
