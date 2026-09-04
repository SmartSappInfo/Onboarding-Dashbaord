import { Metadata } from 'next';
import BackofficeCompanyBrainClient from './components/BackofficeCompanyBrainClient';

export const metadata: Metadata = {
  title: 'CompanyBrain Governance | SmartSapp Backoffice',
  description:
    'Platform control plane for Qdrant vector cluster telemetry, memory index synchronization, embedding cache monitoring, and FER data reconciliation protocols.',
};

export default function BackofficeCompanyBrainPage() {
  return <BackofficeCompanyBrainClient />;
}
