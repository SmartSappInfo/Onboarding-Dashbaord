import { Metadata } from 'next';
import BackofficeKnowledgeGraphClient from './components/BackofficeKnowledgeGraphClient';

export const metadata: Metadata = {
  title: 'Knowledge Graph Governance | SmartSapp Backoffice',
  description:
    'Platform control plane for managing semantic relationship types, tuning AI linking parameters, inspecting graph topology, and running FER CRM migration protocols.',
};

export default function BackofficeKnowledgeGraphPage() {
  return <BackofficeKnowledgeGraphClient />;
}
