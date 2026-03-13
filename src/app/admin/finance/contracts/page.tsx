import { Metadata } from 'next';
import AgreementsClient from './ContractsClient';

/**
 * @fileOverview Agreements & Contracts Hub Page (Server Entry).
 * Central point for managing institutional legal contracts.
 */

export const metadata: Metadata = {
  title: 'Agreements & Contracts',
  description: 'Manage all agreements and legal contracts executions.',
};

export default function AgreementsPage() {
  return <AgreementsClient />;
}
