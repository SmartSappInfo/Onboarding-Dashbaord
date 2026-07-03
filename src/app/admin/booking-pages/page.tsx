import { Suspense } from 'react';
import BookingBuilderClientWrapper from './BookingBuilderClientWrapper';

export const metadata = {
  title: 'Public Booking Pages Builder',
  description: 'Manage and construct public scheduling pages for your workspaces.',
};

export default async function AdminBookingPagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[500px] w-full" />}>
      <BookingBuilderClientWrapper />
    </Suspense>
  );
}
