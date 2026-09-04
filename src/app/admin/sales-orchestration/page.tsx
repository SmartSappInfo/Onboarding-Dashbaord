import type { Metadata } from 'next';
import SalesOrchestrationClient from './SalesOrchestrationClient';

export const metadata: Metadata = {
  title: 'Sales Orchestration & Plays | SmartSapp Sales Performance',
  description:
    'Signal-triggered sales plays, visual play builder, intelligent workload routing, SLA escalation matrix, and human-in-the-loop approvals.',
};

export default function SalesOrchestrationPage() {
  return <SalesOrchestrationClient />;
}
