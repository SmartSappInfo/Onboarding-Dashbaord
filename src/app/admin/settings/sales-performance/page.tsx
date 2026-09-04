import { Metadata } from 'next';
import SalesPerformanceClient from './SalesPerformanceClient';

export const metadata: Metadata = {
  title: 'Performance Policy Studio | SmartSapp Sales Intelligence',
  description:
    'Visual no-code performance policy workbench: custom scoring rules, anti-gaming safeguards, dimension weights, and pre-publish commission impact simulation.',
};

export default function SalesPerformancePage() {
  return <SalesPerformanceClient />;
}
