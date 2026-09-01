import * as React from 'react';
import { PeopleAnalyticsClient } from './PeopleAnalyticsClient';

export const metadata = {
  title: 'People Analytics & Adoption | SmartSapp Workforce',
  description: 'Workforce adoption metrics, squad performance, least-privilege telemetry, and live activity stream',
};

export default function AdminPeopleAnalyticsPage() {
  return <PeopleAnalyticsClient />;
}
