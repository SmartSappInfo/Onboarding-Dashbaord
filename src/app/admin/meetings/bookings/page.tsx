import * as React from 'react';
import type { Metadata } from 'next';
import BookingsClient from './BookingsClient';

export const metadata: Metadata = {
  title: 'Customer Bookings | SmartSapp Meetings',
  description: 'Manage and monitor all customer appointment bookings across your workspace.',
};

export default function BookingsPage() {
  return <BookingsClient />;
}
