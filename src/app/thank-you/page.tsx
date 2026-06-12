import type { Metadata } from 'next';
import ThankYouClient from './client';

export const metadata: Metadata = {
  title: 'Thank You — SmartSapp',
  description: 'Your demo request is successfully sent. A product specialist will reach out to you shortly.',
};

export default function ThankYouPage() {
  return <ThankYouClient />;
}
