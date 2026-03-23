import MessagingClient from './MessagingClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Center',
  description: 'Centralized messaging infrastructure for multi-channel SMS and Email dispatches across the school network.',
};

export default function MessagingHubPage() {
  return <MessagingClient />;
}
