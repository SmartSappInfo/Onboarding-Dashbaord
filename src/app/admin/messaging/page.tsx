import MessagingClient from './MessagingClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Center',
  description: 'Send and manage email and SMS messages.',
};

export default function MessagingHubPage() {
  return <MessagingClient />;
}
