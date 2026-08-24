import { Metadata } from 'next';
import { MigrationClient } from './MigrationClient';

export const metadata: Metadata = {
  title: 'Finance Migration & Parity Studio | SmartSapp Finance',
  description: 'Automated data migration engine, ledger backfill, and parity diagnostics.',
};

export default function FinanceMigrationPage() {
  return <MigrationClient />;
}
