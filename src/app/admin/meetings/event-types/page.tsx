import * as React from 'react';
import type { Metadata } from 'next';
import EventTypesClient from './EventTypesClient';

export const metadata: Metadata = {
  title: 'Event Types | SmartSapp Meetings',
  description: 'Manage reusable meeting formats, consultations, and booking definitions.',
};

export default function EventTypesPage() {
  return <EventTypesClient />;
}
