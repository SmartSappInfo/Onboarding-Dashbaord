/**
 * @fileoverview Platform Control Plane Tenant Health & Issue Triage Page (RSC Entrypoint)
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Clean RSC boundary delegating interactive state to `HealthDashboardClient`.
 * - Metadata configured for Super Admin Control Plane.
 */

import { Metadata } from 'next';
import HealthDashboardClient from './components/HealthDashboardClient';

export const metadata: Metadata = {
  title: 'Tenant Health & Issue Triage | SmartSapp Backoffice',
  description: 'Real-time multi-tenant observability, auto-detected anomalies, and support triage.',
};

export default function TenantHealthPage() {
  return <HealthDashboardClient />;
}
