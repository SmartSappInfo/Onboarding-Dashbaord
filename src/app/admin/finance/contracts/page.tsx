
import { Metadata } from 'next';
import AgreementsClient from './ContractsClient';

/**
 * @fileOverview Agreements Hub Page (Server Entry).
 * Central point for managing institutional legal contracts.
 */

export const metadata: Metadata = {
  title: 'Institutional Agreements',
  description: 'Manage legal contracts, track signature status, and audit institutional compliance across the school network.',
};

export default function AgreementsPage() {
  return <AgreementsClient />;
}
