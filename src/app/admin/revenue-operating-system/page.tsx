import { Metadata } from 'next';
import RevenueOperatingSystemClient from './RevenueOperatingSystemClient';

export const metadata: Metadata = {
  title: 'Revenue Operating System & Boardroom | SmartSapp CRM',
  description: 'Executive boardroom intelligence, real-time What-If scenario simulations, quota capacity planning, and predictive churn prevention.',
};

export default function RevenueOperatingSystemPage() {
  return <RevenueOperatingSystemClient />;
}
