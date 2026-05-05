import type { Metadata } from 'next';
import ConversationsClient from './ConversationsClient';

export const metadata: Metadata = {
  title: 'Conversations',
  description: 'View all message threads grouped by contact.',
};

export default function ConversationsPage() {
  return <ConversationsClient />;
}
