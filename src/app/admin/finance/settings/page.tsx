
import FinanceSettingsClient from './FinanceSettingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing Setup',
  description: 'Configure institutional tax rules, remittance instructions, and authorized signatories.',
};

export default function FinanceSettingsPage() {
  return <FinanceSettingsClient />;
}
