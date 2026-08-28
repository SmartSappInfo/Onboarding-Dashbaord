/**
 * @fileoverview Platform Control Plane Meetings Operations RSC Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - RSC boundary delegating telemetry to `MeetingsMonitorClient`.
 */

import { Metadata } from 'next';
import MeetingsMonitorClient from './components/MeetingsMonitorClient';

export const metadata: Metadata = {
  title: 'Meetings & Events Monitor | SmartSapp Backoffice',
  description: 'Real-time active room telemetry, magic link delivery inspector, and facilitator readiness.',
};

export default function MeetingsMonitorPage() {
  return <MeetingsMonitorClient />;
}
