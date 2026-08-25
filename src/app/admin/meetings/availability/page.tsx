import * as React from 'react';
import type { Metadata } from 'next';
import AvailabilityClient from './AvailabilityClient';

export const metadata: Metadata = {
  title: 'Availability Schedules | SmartSapp Meetings',
  description: 'Configure working hours, date overrides, buffers, and booking horizons.',
};

export default function AvailabilityPage() {
  return <AvailabilityClient />;
}
