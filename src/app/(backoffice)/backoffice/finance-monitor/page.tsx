/**
 * @fileoverview Platform Control Plane Financial Operations RSC Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - RSC boundary delegating financial telemetry to `FinanceMonitorClient`.
 */

import { Metadata } from 'next';
import FinanceMonitorClient from './components/FinanceMonitorClient';

export const metadata: Metadata = {
  title: 'Financial Operations Monitor | SmartSapp Backoffice',
  description: 'Cross-tenant MRR/ARR telemetry, payment gateway health, and overdue aging receivables.',
};

export default function FinanceMonitorPage() {
  return <FinanceMonitorClient />;
}
