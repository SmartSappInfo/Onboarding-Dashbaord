/**
 * @fileoverview Platform Control Plane Messaging Observatory RSC Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - RSC boundary delegating interactive telemetry to `MessagingObservatoryClient`.
 */

import { Metadata } from 'next';
import MessagingObservatoryClient from './components/MessagingObservatoryClient';

export const metadata: Metadata = {
  title: 'Messaging Observatory & Dead-Letter Queue | SmartSapp Backoffice',
  description: 'Cross-tenant dispatch telemetry, bounce patterns, and outbound webhook DLQ replays.',
};

export default function MessagingObservatoryPage() {
  return <MessagingObservatoryClient />;
}
