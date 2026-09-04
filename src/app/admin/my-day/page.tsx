import { Metadata } from 'next';
import MyDayClient from './MyDayClient';

export const metadata: Metadata = {
  title: 'My Day | SmartSapp Seller Workspace',
  description: 'AI-prioritized daily sales execution queue, next-best-actions, and performance pacing.',
};

export default function MyDayPage() {
  return <MyDayClient />;
}
