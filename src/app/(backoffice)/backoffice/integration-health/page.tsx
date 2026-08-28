/**
 * @fileoverview Platform Control Plane Integration Health RSC Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - RSC boundary delegating telemetry to `IntegrationHealthClient`.
 */

import { Metadata } from 'next';
import IntegrationHealthClient from './components/IntegrationHealthClient';

export const metadata: Metadata = {
  title: 'Integration Health & Token Sentinel | SmartSapp Backoffice',
  description: 'OAuth token expiry radar, provider connectivity tests, and rate limit quotas.',
};

export default function IntegrationHealthPage() {
  return <IntegrationHealthClient />;
}
