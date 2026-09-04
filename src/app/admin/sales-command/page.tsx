import { Metadata } from 'next';
import SalesCommandClient from './SalesCommandClient';

export const metadata: Metadata = {
  title: 'Manager Command Center | SmartSapp Sales Intelligence',
  description:
    'Executive sales leadership command center: pipeline health, team capacity heatmap, 1:1 coaching studio, and operational risk interventions.',
};

export default function SalesCommandPage() {
  return <SalesCommandClient />;
}
