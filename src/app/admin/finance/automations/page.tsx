import { Metadata } from 'next';
import { FinanceAutomationsClient } from './FinanceAutomationsClient';

export const metadata: Metadata = {
  title: 'Finance Automations & Reminders | SmartSapp Finance',
  description: 'Automated payment reminder policies, dunning schedules, and delivery telemetry.',
};

export default function FinanceAutomationsPage() {
  return <FinanceAutomationsClient />;
}
