import { Metadata } from 'next';
import SalesPerformanceClient from './SalesPerformanceClient';

export const metadata: Metadata = {
  title: 'Sales Performance Rules Configuration',
  description: 'Manage point weights and toggle automatic sales effort scoring metrics.',
};

export default function SalesPerformancePage() {
  return <SalesPerformanceClient />;
}
