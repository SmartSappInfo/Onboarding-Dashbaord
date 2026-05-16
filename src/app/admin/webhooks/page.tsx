import WebhooksClient from './WebhooksClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Webhook Hub | Admin',
  description: 'Manage inbound and outbound webhooks for real-time system integrations.',
};

export default function WebhooksPage() {
  return <WebhooksClient />;
}
